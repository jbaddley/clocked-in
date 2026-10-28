using System.Text.Json;
using System.Text.Json.Nodes;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.AccessRequests;

public sealed record RequestedRoleDto(string Code, string Name);

public sealed record AccessRequestDto(
    Guid Id,
    Guid OrganizationId,
    Guid? UserId,
    Guid? GuestId,
    string Email,
    string Name,
    Guid? RequestedRoleId,
    RequestedRoleDto? RequestedRole,
    IReadOnlyList<string> RequestedDepartmentIds,
    string? Message,
    string Status,
    Guid? ReviewedByUserId,
    DateTime? ReviewedAt,
    Guid? VolunteerNeedId,
    DateTime CreatedAt)
{
    public static AccessRequestDto From(AccessRequest row)
    {
        var departmentIds = ParseDepartmentIds(row.RequestedDepartmentIds);
        var profile = row.User?.Profile;
        var name =
            row.Guest?.Name
            ?? profile?.DisplayName
            ?? string.Join(" ", new[] { profile?.FirstName, profile?.LastName }.Where(item => !string.IsNullOrWhiteSpace(item))).Trim()
            ?? row.User?.Username
            ?? row.User?.Email
            ?? row.Guest?.Email
            ?? "Unknown";
        if (string.IsNullOrWhiteSpace(name))
        {
            name = "Unknown";
        }

        RequestedRoleDto? requestedRole = row.RequestedRole is { } role
            ? new RequestedRoleDto(role.Code, role.Name)
            : departmentIds.Count > 0
                ? new RequestedRoleDto("GROUP_MANAGER", "Group manager")
                : null;
        return new(
            row.Id,
            row.OrganizationId,
            row.UserId,
            row.GuestId,
            row.User?.Email ?? row.Guest?.Email ?? "",
            name,
            row.RequestedRoleId,
            requestedRole,
            departmentIds.Select(id => id.ToString()).ToList(),
            row.Message,
            row.Status,
            row.ReviewedByUserId,
            row.ReviewedAt,
            row.VolunteerNeedId,
            row.CreatedAt);
    }

    public static List<Guid> ParseDepartmentIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<Guid>>(json) ?? [];
        }
        catch (JsonException)
        {
            return JsonSerializer.Deserialize<List<string>>(json)?
                .Select(item => Guid.TryParse(item, out var id) ? id : Guid.Empty)
                .Where(id => id != Guid.Empty)
                .ToList() ?? [];
        }
    }
}

public sealed record CreateAccessRequestBody(
    string? Message,
    string RequestedRole,
    List<Guid> RequestedDepartmentIds,
    string? Email,
    string? Name,
    Guid? VolunteerNeedId,
    Guid? GuestId)
{
    public static async ValueTask<CreateAccessRequestBody?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        return new(
            Fields.Has(body, "message") ? Fields.RequiredString(body, "message").Trim()[..Math.Min(2000, Fields.RequiredString(body, "message").Trim().Length)] : null,
            Fields.Has(body, "requestedRole") ? Fields.RequiredString(body, "requestedRole") : "GROUP_MANAGER",
            GuidList(body, "requestedDepartmentIds"),
            Fields.Has(body, "email") ? Fields.NormalizeEmail(Fields.RequiredString(body, "email")) : null,
            Fields.Has(body, "name") ? Fields.RequiredString(body, "name").Trim() : null,
            Fields.Has(body, "volunteerNeedId") ? Fields.RequiredGuid(body, "volunteerNeedId") : null,
            Fields.Has(body, "guestId") ? Fields.RequiredGuid(body, "guestId") : null);
    }

    private static List<Guid> GuidList(JsonObject body, string key)
    {
        if (!Fields.Has(body, key) || body[key] is null)
        {
            return [];
        }

        if (body[key] is not JsonArray array)
        {
            throw ApiException.Validation($"{key} must be an array.");
        }

        var ids = new List<Guid>();
        foreach (var item in array)
        {
            if (item is not JsonValue value || !value.TryGetValue<string>(out var text) || !Guid.TryParse(text, out var id))
            {
                throw ApiException.Validation($"{key} must be an array of ids.");
            }

            ids.Add(id);
        }

        return ids;
    }
}

public sealed record DecideAccessRequestBody(string Status)
{
    public static async ValueTask<DecideAccessRequestBody?> BindAsync(HttpContext context)
    {
        var status = Fields.RequiredString(await Body.Read(context), "status");
        if (status is not ("approved" or "declined"))
        {
            throw ApiException.Validation("status must be approved or declined.");
        }

        return new(status);
    }
}

public sealed class AccessRequestsService(ClockedInDbContext db, Access access, IEmailSender mail, TimeProvider time)
{
    public async Task<ListResponse<AccessRequestDto>> List(Guid organizationId, PageQuery query, string? status, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequirePermission(organizationId, "approve_access_requests", cancellationToken);
        var rows = await Include()
            .Where(item => item.OrganizationId == organizationId && (status == null || item.Status == status))
            .OrderByDescending(item => item.CreatedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(rows.Select(AccessRequestDto.From).ToList(), page);
    }

    public async Task<AccessRequestDto> Create(Guid organizationId, CreateAccessRequestBody request, CancellationToken cancellationToken)
    {
        var organization = await access.RequireOrganization(organizationId, false, cancellationToken);
        Guid? requestedRoleId = request.RequestedRole == "GROUP_MANAGER"
            ? null
            : await ResolveRoleId(request.RequestedRole, organizationId, cancellationToken);
        var existing = await db.AccessRequests.AnyAsync(
            item => item.OrganizationId == organizationId && item.UserId == access.ActorUserId && item.Status == "pending",
            cancellationToken);
        if (existing)
        {
            throw ApiException.Conflict("You already have a pending access request.");
        }

        var created = new AccessRequest
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            UserId = access.ActorUserId,
            RequestedRoleId = requestedRoleId,
            RequestedDepartmentIds = JsonSerializer.Serialize(request.RequestedDepartmentIds),
            Message = request.Message,
            VolunteerNeedId = request.VolunteerNeedId,
            Status = "pending",
            CreatedAt = time.UtcNow(),
        };
        db.AccessRequests.Add(created);
        await db.SaveOrThrowAsync(cancellationToken);
        await NotifyAdmins(organizationId, organization.Name, access.Caller.Email, cancellationToken);
        return AccessRequestDto.From(await Load(created.Id, cancellationToken));
    }

    public async Task<AccessRequestDto> Decide(Guid organizationId, Guid requestId, DecideAccessRequestBody request, CancellationToken cancellationToken)
    {
        var organization = await access.RequirePermission(organizationId, "approve_access_requests", cancellationToken);
        var row = await Include().FirstOrDefaultAsync(item => item.Id == requestId && item.OrganizationId == organizationId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (row.Status != "pending")
        {
            throw ApiException.Conflict("This request has already been reviewed.");
        }

        if (request.Status == "approved")
        {
            await Approve(row, cancellationToken);
        }

        row.Status = request.Status;
        row.ReviewedByUserId = access.ActorUserId;
        row.ReviewedAt = time.UtcNow();
        await db.SaveOrThrowAsync(cancellationToken);
        var email = row.User?.Email ?? row.Guest?.Email;
        if (email is not null)
        {
            await mail.Send(
                email,
                organizationId,
                EmailTemplateFor.AccessRequestDecided,
                new Dictionary<string, string?>
                {
                    ["organization.name"] = organization.Name,
                    ["request.decision"] = request.Status == "approved" ? "approved" : "declined",
                    ["user.name"] = row.User?.Profile?.FirstName ?? row.Guest?.Name ?? "there",
                },
                cancellationToken);
        }

        return AccessRequestDto.From(await Load(row.Id, cancellationToken));
    }

    private async Task Approve(AccessRequest row, CancellationToken cancellationToken)
    {
        if (row.UserId is not Guid userId)
        {
            return;
        }

        if (row.RequestedRoleId is Guid roleId)
        {
            await db.OrganizationMemberships
                .Where(item => item.UserId == userId && item.OrganizationId == row.OrganizationId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.RoleId, roleId), cancellationToken);
        }

        foreach (var departmentId in AccessRequestDto.ParseDepartmentIds(row.RequestedDepartmentIds))
        {
            var existing = await db.DepartmentMemberships.FirstOrDefaultAsync(
                item => item.UserId == userId && item.DepartmentId == departmentId,
                cancellationToken);
            if (existing is null)
            {
                db.DepartmentMemberships.Add(new DepartmentMembership
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    DepartmentId = departmentId,
                    RoleId = Role.AdminId,
                    JoinedAt = time.UtcNow(),
                });
            }
            else
            {
                existing.RoleId = Role.AdminId;
            }
        }

        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task NotifyAdmins(Guid organizationId, string organizationName, string requesterEmail, CancellationToken cancellationToken)
    {
        var emails = await db.OrganizationMemberships.AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.IsActive && item.Role.Code == "ADMIN")
            .Select(item => item.User.Email)
            .ToListAsync(cancellationToken);
        foreach (var email in emails)
        {
            try
            {
                await mail.Send(
                    email,
                    organizationId,
                    EmailTemplateFor.AccessRequestReceived,
                    new Dictionary<string, string?>
                    {
                        ["organization.name"] = organizationName,
                        ["request.requesterEmail"] = requesterEmail,
                    },
                    cancellationToken);
            }
            catch
            {
                // One failed admin notice should not block the request.
            }
        }
    }

    private async Task<Guid> ResolveRoleId(string role, Guid organizationId, CancellationToken cancellationToken)
    {
        var code = role.Trim().ToUpperInvariant();
        var found = await db.Roles.AsNoTracking()
            .Where(item => item.Code == code && (item.OrganizationId == null || item.OrganizationId == organizationId))
            .Select(item => (Guid?)item.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return found ?? throw ApiException.Validation("requestedRole is not a valid role.");
    }

    private IQueryable<AccessRequest> Include() =>
        db.AccessRequests
            .Include(item => item.User)!.ThenInclude(user => user!.Profile)
            .Include(item => item.Guest)
            .Include(item => item.RequestedRole);

    private async Task<AccessRequest> Load(Guid id, CancellationToken cancellationToken) =>
        await Include().FirstAsync(item => item.Id == id, cancellationToken);
}

public static class AccessRequestsEndpoints
{
    public static void MapAccessRequestsEndpoints(this IEndpointRouteBuilder app)
    {
        var requests = app.MapGroup("/organizations/{id:guid}/access-requests").RequireAuthorization();
        requests.MapGet("", async Task<Ok<ListResponse<AccessRequestDto>>> (
            Guid id,
            [AsParameters] PageQuery query,
            string? status,
            AccessRequestsService service,
            CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, status, ct)));
        requests.MapPost("", async Task<Created<AccessRequestDto>> (Guid id, CreateAccessRequestBody request, AccessRequestsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));
        requests.MapPatch("/{requestId:guid}", async Task<Ok<AccessRequestDto>> (
            Guid id,
            Guid requestId,
            DecideAccessRequestBody request,
            AccessRequestsService service,
            CancellationToken ct) =>
            TypedResults.Ok(await service.Decide(id, requestId, request, ct)));
    }
}
