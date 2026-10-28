using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Roles;

public sealed record OrganizationRoleDto(
    Guid Id,
    string Code,
    string Name,
    Guid? OrganizationId,
    bool IsSystem,
    string Scope,
    IReadOnlyList<string> Permissions)
{
    public static OrganizationRoleDto From(Role role)
    {
        var granted = role.Permissions.Count > 0
            ? role.Permissions.Where(item => item.Allowed).Select(item => item.Permission).ToList()
            : Shared.Permissions.DefaultForCode(role.Code).ToList();
        return new(role.Id, role.Code, role.Name, role.OrganizationId, role.IsSystem, role.Scope, granted);
    }
}

public sealed record CreateRoleRequest(string Name, string Code, string Scope, List<string> Permissions)
{
    public static async ValueTask<CreateRoleRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        var name = Fields.RequiredString(body, "name").Trim();
        if (name.Length is < 2 or > 80)
        {
            throw ApiException.Validation("name must be 2 to 80 characters.");
        }

        var code = Fields.Has(body, "code")
            ? Fields.RequiredString(body, "code").Trim().ToUpperInvariant()
            : CodeFromName(name);
        if (!Regex.IsMatch(code, @"^[A-Z][A-Z0-9_]{1,49}$"))
        {
            throw ApiException.Validation("code must be 2 to 50 letters, numbers, or underscores.");
        }

        return new(
            name,
            code,
            Fields.Has(body, "scope") ? Shared.Permissions.NormalizeScope(Fields.RequiredString(body, "scope")) : "assigned_groups",
            ParsePermissions(body));
    }

    private static string CodeFromName(string name)
    {
        var cleaned = Regex.Replace(name.Trim().ToUpperInvariant(), @"[^A-Z0-9]+", "_").Trim('_');
        if (cleaned.Length > 40)
        {
            cleaned = cleaned[..40];
        }

        return cleaned.Length >= 2 ? cleaned : "CUSTOM";
    }

    public static List<string> ParsePermissions(JsonObject body)
    {
        if (!Fields.Has(body, "permissions") || body["permissions"] is not JsonArray array)
        {
            throw ApiException.Validation("permissions must be an array.");
        }

        var unique = array
            .Select(item => item is JsonValue value && value.TryGetValue<string>(out var text) ? text : null)
            .Where(item => item is not null)
            .Cast<string>()
            .Distinct()
            .ToList();
        foreach (var item in unique)
        {
            if (!Shared.Permissions.IsKnown(item))
            {
                throw ApiException.Validation($"Unknown permission {item}.");
            }
        }

        return unique;
    }
}

public sealed record UpdateRoleRequest(string? Name, string? Scope, List<string>? Permissions)
{
    public static async ValueTask<UpdateRoleRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        string? name = null;
        string? scope = null;
        List<string>? permissions = null;
        if (Fields.Has(body, "name"))
        {
            name = Fields.RequiredString(body, "name").Trim();
            if (name.Length is < 2 or > 80)
            {
                throw ApiException.Validation("name must be 2 to 80 characters.");
            }
        }

        if (Fields.Has(body, "scope"))
        {
            scope = Shared.Permissions.NormalizeScope(Fields.RequiredString(body, "scope"));
        }

        if (Fields.Has(body, "permissions"))
        {
            permissions = CreateRoleRequest.ParsePermissions(body);
        }

        if (name is null && scope is null && permissions is null)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return new(name, scope, permissions);
    }
}

public sealed class RolesService(ClockedInDbContext db, Access access)
{
    public async Task<ListResponse<OrganizationRoleDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var roles = await db.Roles.AsNoTracking()
            .Include(role => role.Permissions)
            .Where(role => role.OrganizationId == null || role.OrganizationId == organizationId)
            .OrderByDescending(role => role.IsSystem)
            .ThenBy(role => role.Name)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(roles.Select(OrganizationRoleDto.From).ToList(), page);
    }

    public async Task<OrganizationRoleDto> Create(Guid organizationId, CreateRoleRequest request, CancellationToken cancellationToken)
    {
        await access.RequirePermission(organizationId, "manage_roles", cancellationToken);
        var existing = await db.Roles.AnyAsync(
            role => role.Code == request.Code && (role.OrganizationId == null || role.OrganizationId == organizationId),
            cancellationToken);
        if (existing)
        {
            throw ApiException.Conflict("A role with that code already exists.");
        }

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Code = request.Code,
            Name = request.Name,
            OrganizationId = organizationId,
            IsSystem = false,
            Scope = request.Scope,
            Permissions = request.Permissions
                .Select(permission => new RolePermission { Id = Guid.NewGuid(), Permission = permission, Allowed = true })
                .ToList(),
        };
        db.Roles.Add(role);
        await db.SaveOrThrowAsync(cancellationToken);
        return OrganizationRoleDto.From(role);
    }

    public async Task<OrganizationRoleDto> Update(Guid organizationId, Guid roleId, UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        await access.RequirePermission(organizationId, "manage_roles", cancellationToken);
        var role = await db.Roles
            .Include(item => item.Permissions)
            .FirstOrDefaultAsync(
                item => item.Id == roleId && (item.OrganizationId == null || item.OrganizationId == organizationId),
                cancellationToken) ?? throw ApiException.NotFound();
        if (role.IsSystem && !access.IsSuperAdmin)
        {
            throw ApiException.Forbidden();
        }

        if (role.IsSystem && role.Code == "ADMIN" && request.Permissions is { } adminPermissions)
        {
            if (!adminPermissions.Contains("manage_roles") || !adminPermissions.Contains("manage_members"))
            {
                throw ApiException.Validation("Admin must keep manage_roles and manage_members.");
            }
        }

        if (request.Permissions is { } permissions)
        {
            db.RolePermissions.RemoveRange(role.Permissions);
            role.Permissions = permissions
                .Select(permission => new RolePermission { Id = Guid.NewGuid(), RoleId = role.Id, Permission = permission, Allowed = true })
                .ToList();
        }

        if (request.Name is not null)
        {
            role.Name = request.Name;
        }

        if (request.Scope is not null)
        {
            role.Scope = request.Scope;
        }

        await db.SaveOrThrowAsync(cancellationToken);
        await db.Entry(role).Collection(item => item.Permissions).LoadAsync(cancellationToken);
        return OrganizationRoleDto.From(role);
    }

    public async Task Delete(Guid organizationId, Guid roleId, CancellationToken cancellationToken)
    {
        await access.RequirePermission(organizationId, "manage_roles", cancellationToken);
        var role = await db.Roles.FirstOrDefaultAsync(item => item.Id == roleId && item.OrganizationId == organizationId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (role.IsSystem)
        {
            throw ApiException.Validation("System roles cannot be deleted.");
        }

        var assigned = await db.OrganizationMemberships.CountAsync(item => item.RoleId == roleId, cancellationToken)
            + await db.DepartmentMemberships.CountAsync(item => item.RoleId == roleId, cancellationToken)
            + await db.Invitations.CountAsync(item => item.RoleId == roleId && item.AcceptedAt == null && item.RevokedAt == null, cancellationToken);
        if (assigned > 0)
        {
            throw ApiException.Conflict("This role is still assigned.");
        }

        db.Roles.Remove(role);
        await db.SaveOrThrowAsync(cancellationToken);
    }
}

public static class RolesEndpoints
{
    public static void MapRolesEndpoints(this IEndpointRouteBuilder app)
    {
        var roles = app.MapGroup("/organizations/{id:guid}/roles").RequireAuthorization();
        roles.MapGet("", async Task<Ok<ListResponse<OrganizationRoleDto>>> (Guid id, [AsParameters] PageQuery query, RolesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        roles.MapPost("", async Task<Created<OrganizationRoleDto>> (Guid id, CreateRoleRequest request, RolesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));
        roles.MapPatch("/{roleId:guid}", async Task<Ok<OrganizationRoleDto>> (Guid id, Guid roleId, UpdateRoleRequest request, RolesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, roleId, request, ct)));
        roles.MapDelete("/{roleId:guid}", async Task<NoContent> (Guid id, Guid roleId, RolesService service, CancellationToken ct) =>
        {
            await service.Delete(id, roleId, ct);
            return TypedResults.NoContent();
        });
    }
}
