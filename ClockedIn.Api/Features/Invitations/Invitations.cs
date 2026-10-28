using System.Linq.Expressions;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Memberships;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Features.Invitations;

public sealed record InvitationDto(
    Guid Id,
    string Email,
    Guid OrganizationId,
    Guid? DepartmentId,
    RoleDto Role,
    Guid InvitedByUserId,
    DateTime ExpiresAt,
    DateTime? AcceptedAt,
    DateTime? RevokedAt,
    DateTime CreatedAt)
{
    public static InvitationDto From(Invitation invitation) => new(
        invitation.Id,
        invitation.Email,
        invitation.OrganizationId,
        invitation.DepartmentId,
        RoleDto.From(invitation.Role),
        invitation.InvitedByUserId,
        invitation.ExpiresAt,
        invitation.AcceptedAt,
        invitation.RevokedAt,
        invitation.CreatedAt);
}

public sealed record AcceptedInvitationDto(
    InvitationDto Invitation,
    MembershipDto? OrganizationMembership,
    MembershipDto? DepartmentMembership);

public sealed record CreateInvitationRequest(
    string Email,
    RoleCode Role,
    string FirstName = "Volunteer",
    string LastName = "",
    string? Username = null)
{
    public static async ValueTask<CreateInvitationRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        return new CreateInvitationRequest(
            Fields.NormalizeEmail(Fields.RequiredString(body, "email")),
            Fields.NormalizeRole(Fields.RequiredString(body, "role")),
            Fields.Has(body, "firstName") ? Fields.PersonName(Fields.RequiredString(body, "firstName"), "firstName") : "Volunteer",
            Fields.Has(body, "lastName") ? Fields.PersonName(Fields.RequiredString(body, "lastName"), "lastName") : "",
            Fields.Has(body, "username") ? Fields.NormalizeUsername(Fields.RequiredString(body, "username")) : null);
    }
}

public sealed record AcceptInvitationRequest(string Code)
{
    public static async ValueTask<AcceptInvitationRequest?> BindAsync(HttpContext context) =>
        new(Fields.RequiredString(await Body.Read(context), "code"));
}

public sealed class InvitationsService(
    ClockedInDbContext db,
    Access access,
    IEmailSender mail,
    IOptions<EmailOptions> emailOptions,
    TimeProvider time)
{
    public async Task<InvitationDto> CreateForOrganization(Guid organizationId, CreateInvitationRequest request, CancellationToken cancellationToken)
    {
        var organization = await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        return await Create(organization.Id, null, InviteTarget(organization), request, cancellationToken);
    }

    public async Task<InvitationDto> CreateForDepartment(Guid departmentId, CreateInvitationRequest request, CancellationToken cancellationToken)
    {
        var department = await access.RequireDepartmentManager(departmentId, cancellationToken);
        var organization = await access.RequireOrganization(department.OrganizationId, false, cancellationToken);
        return await Create(department.OrganizationId, department.Id, InviteTarget(organization, department.Name), request, cancellationToken);
    }

    public async Task<ListResponse<InvitationDto>> ListForOrganization(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        return await List(invitation => invitation.OrganizationId == organizationId && invitation.DepartmentId == null, page, cancellationToken);
    }

    public async Task<ListResponse<InvitationDto>> ListForDepartment(Guid departmentId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireDepartmentManager(departmentId, cancellationToken);
        return await List(invitation => invitation.DepartmentId == departmentId, page, cancellationToken);
    }

    public async Task<InvitationDto> RevokeForOrganization(Guid organizationId, Guid invitationId, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        return await Revoke(
            invitation => invitation.Id == invitationId && invitation.OrganizationId == organizationId && invitation.DepartmentId == null,
            cancellationToken);
    }

    public async Task<InvitationDto> RevokeForDepartment(Guid departmentId, Guid invitationId, CancellationToken cancellationToken)
    {
        await access.RequireDepartmentManager(departmentId, cancellationToken);
        return await Revoke(invitation => invitation.Id == invitationId && invitation.DepartmentId == departmentId, cancellationToken);
    }

    public async Task<AcceptedInvitationDto> Accept(AcceptInvitationRequest request, CancellationToken cancellationToken)
    {
        var caller = access.RequireHuman();
        var hash = Codes.Hash(request.Code);
        var now = time.UtcNow();
        var invitation = await db.Invitations.Include(item => item.Role).FirstOrDefaultAsync(item => item.CodeHash == hash, cancellationToken);
        if (invitation is null || invitation.AcceptedAt is not null || invitation.RevokedAt is not null || invitation.ExpiresAt <= now)
        {
            throw ApiException.Validation("The code is not valid.");
        }

        if (invitation.Email != caller.Email)
        {
            throw new ApiException(403, "forbidden", "This invite was sent to a different email.");
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockUserAsync(caller.Id, cancellationToken);
        await db.Entry(invitation).ReloadAsync(cancellationToken);
        if (invitation.AcceptedAt is not null || invitation.RevokedAt is not null || invitation.ExpiresAt <= now)
        {
            throw ApiException.Validation("The code is not valid.");
        }

        var memberOfOrganization = await db.OrganizationMemberships.AnyAsync(
            item => item.UserId == caller.Id && item.OrganizationId == invitation.OrganizationId,
            cancellationToken);
        OrganizationMembership? organizationMembership = null;
        DepartmentMembership? departmentMembership = null;
        if (invitation.DepartmentId is Guid departmentId)
        {
            if (await db.DepartmentMemberships.AnyAsync(item => item.UserId == caller.Id && item.DepartmentId == departmentId, cancellationToken))
            {
                throw ApiException.Conflict("You are already a member.");
            }

            if (!memberOfOrganization)
            {
                organizationMembership = await NewOrganizationMembership(invitation.OrganizationId, Role.MemberId, now, cancellationToken);
            }

            departmentMembership = new DepartmentMembership
            {
                Id = Guid.NewGuid(),
                UserId = caller.Id,
                DepartmentId = departmentId,
                RoleId = invitation.RoleId,
                JoinedAt = now,
            };
            db.DepartmentMemberships.Add(departmentMembership);
        }
        else
        {
            if (memberOfOrganization)
            {
                throw ApiException.Conflict("You are already a member.");
            }

            organizationMembership = await NewOrganizationMembership(invitation.OrganizationId, invitation.RoleId, now, cancellationToken);
        }

        invitation.AcceptedAt = now;
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return new AcceptedInvitationDto(
            InvitationDto.From(invitation),
            organizationMembership is null ? null : MembershipDto.From(
                await LoadOrganizationMembership(organizationMembership.Id, cancellationToken),
                invitation.DepartmentId is Guid acceptedDepartmentId ? [acceptedDepartmentId] : []),
            departmentMembership is null ? null : MembershipDto.From(await LoadDepartmentMembership(departmentMembership.Id, cancellationToken), invitation.OrganizationId));
    }

    private async Task<OrganizationMembership> NewOrganizationMembership(Guid organizationId, Guid roleId, DateTime now, CancellationToken cancellationToken)
    {
        var rateType = await db.Organizations.Where(item => item.Id == organizationId).Select(item => item.DefaultRateType).FirstAsync(cancellationToken);
        var membership = new OrganizationMembership
        {
            Id = Guid.NewGuid(),
            UserId = access.Caller.Id,
            OrganizationId = organizationId,
            RoleId = roleId,
            RateType = rateType,
            IsActive = true,
            JoinedAt = now,
        };
        db.OrganizationMemberships.Add(membership);
        return membership;
    }

    private Task<OrganizationMembership> LoadOrganizationMembership(Guid id, CancellationToken cancellationToken) =>
        db.OrganizationMemberships.AsNoTracking().Include(item => item.Role).Include(item => item.User).ThenInclude(user => user.Profile).FirstAsync(item => item.Id == id, cancellationToken);

    private Task<DepartmentMembership> LoadDepartmentMembership(Guid id, CancellationToken cancellationToken) =>
        db.DepartmentMemberships.AsNoTracking().Include(item => item.Role).Include(item => item.User).ThenInclude(user => user.Profile).FirstAsync(item => item.Id == id, cancellationToken);

    private static (string Kind, string Name) InviteTarget(Organization organization, string? departmentName = null)
    {
        var labels = organization.Preferences?.EntityLabels;
        var kind = departmentName is null
            ? (string.IsNullOrWhiteSpace(labels?.Organization) ? "Organization" : labels!.Organization.Trim())
            : (string.IsNullOrWhiteSpace(labels?.Department) ? "Department" : labels!.Department.Trim());
        return (kind, departmentName ?? organization.Name);
    }

    private async Task<InvitationDto> Create(
        Guid organizationId,
        Guid? departmentId,
        (string Kind, string Name) target,
        CreateInvitationRequest request,
        CancellationToken cancellationToken)
    {
        var now = time.UtcNow();
        var code = await Codes.AllocateNumericCode(
            (hash, ct) => db.Invitations.AnyAsync(item => item.CodeHash == hash, ct),
            cancellationToken);
        var username = request.Username ?? await ReserveUsername(request.FirstName, request.LastName, cancellationToken);
        var invitation = new Invitation
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            OrganizationId = organizationId,
            DepartmentId = departmentId,
            RoleId = Role.IdOf(request.Role),
            CodeHash = Codes.Hash(code),
            InvitedByUserId = access.ActorUserId,
            ExpiresAt = now.Add(Codes.InviteLifetime),
            CreatedAt = now,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Username = username,
        };
        db.Invitations.Add(invitation);
        await db.SaveOrThrowAsync(cancellationToken);
        await db.Entry(invitation).Reference(item => item.Role).LoadAsync(cancellationToken);
        try
        {
            await mail.Send(
                request.Email,
                organizationId,
                EmailTemplateFor.Invite,
                new Dictionary<string, string?>
                {
                    ["organization.name"] = target.Name,
                    ["invite.targetKind"] = target.Kind,
                    ["invite.targetName"] = target.Name,
                    ["invite.roleName"] = invitation.Role.Name,
                    ["user.username"] = username,
                    ["invite.code"] = code,
                    ["invite.url"] = emailOptions.Value.Link($"/accept?code={Uri.EscapeDataString(code)}"),
                },
                cancellationToken);
        }
        catch
        {
            db.Invitations.Remove(invitation);
            await db.SaveChangesAsync(cancellationToken);
            throw;
        }

        return InvitationDto.From(invitation);
    }

    private async Task<string> ReserveUsername(string firstName, string lastName, CancellationToken cancellationToken)
    {
        var initial = firstName.Trim().Length > 0 ? char.ToLowerInvariant(firstName.Trim()[0]) : 'u';
        if (initial is < 'a' or > 'z' && initial is < '0' or > '9')
        {
            initial = 'u';
        }

        var last = new string(lastName.ToLowerInvariant().Where(char.IsLetterOrDigit).ToArray());
        if (string.IsNullOrEmpty(last))
        {
            last = "user";
        }

        var baseName = $"{initial}{last}";
        if (baseName.Length < 3)
        {
            baseName = $"{baseName}user";
        }

        if (baseName.Length > 50)
        {
            baseName = baseName[..50];
        }

        for (var attempt = 0; attempt < 1000; attempt += 1)
        {
            var username = attempt == 0 ? baseName : $"{baseName[..Math.Min(48, baseName.Length)]}{attempt}";
            var taken = await db.Users.AnyAsync(user => user.Username == username, cancellationToken)
                || await db.Invitations.AnyAsync(
                    item => item.Username == username && item.AcceptedAt == null && item.RevokedAt == null,
                    cancellationToken);
            if (!taken)
            {
                return username;
            }
        }

        throw ApiException.Validation("username is already in use.");
    }

    private async Task<ListResponse<InvitationDto>> List(
        Expression<Func<Invitation, bool>> predicate,
        Page page,
        CancellationToken cancellationToken)
    {
        var invitations = await db.Invitations.AsNoTracking()
            .Include(invitation => invitation.Role)
            .Where(predicate)
            .OrderByDescending(invitation => invitation.CreatedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(invitations.Select(InvitationDto.From).ToList(), page);
    }

    private async Task<InvitationDto> Revoke(Expression<Func<Invitation, bool>> predicate, CancellationToken cancellationToken)
    {
        var invitation = await db.Invitations.Include(item => item.Role).FirstOrDefaultAsync(predicate, cancellationToken)
            ?? throw ApiException.NotFound();
        if (invitation.AcceptedAt is not null)
        {
            throw ApiException.Conflict("This invite has already been accepted.");
        }

        if (invitation.RevokedAt is null)
        {
            invitation.RevokedAt = time.UtcNow();
            await db.SaveOrThrowAsync(cancellationToken);
        }

        return InvitationDto.From(invitation);
    }
}

public static class InvitationsEndpoints
{
    public static void MapInvitationsEndpoints(this IEndpointRouteBuilder app)
    {
        var organization = app.MapGroup("/organizations/{id:guid}/invitations").RequireAuthorization();
        organization.MapGet("", async Task<Ok<ListResponse<InvitationDto>>> (Guid id, [AsParameters] PageQuery query, InvitationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListForOrganization(id, query, ct)));
        organization.MapPost("", async Task<Created<InvitationDto>> (Guid id, CreateInvitationRequest request, InvitationsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.CreateForOrganization(id, request, ct)));
        organization.MapDelete("/{invitationId:guid}", async Task<Ok<InvitationDto>> (Guid id, Guid invitationId, InvitationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.RevokeForOrganization(id, invitationId, ct)));

        var department = app.MapGroup("/departments/{id:guid}/invitations").RequireAuthorization();
        department.MapGet("", async Task<Ok<ListResponse<InvitationDto>>> (Guid id, [AsParameters] PageQuery query, InvitationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListForDepartment(id, query, ct)));
        department.MapPost("", async Task<Created<InvitationDto>> (Guid id, CreateInvitationRequest request, InvitationsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.CreateForDepartment(id, request, ct)));
        department.MapDelete("/{invitationId:guid}", async Task<Ok<InvitationDto>> (Guid id, Guid invitationId, InvitationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.RevokeForDepartment(id, invitationId, ct)));

        app.MapPost("/invitations/accept", async Task<Ok<AcceptedInvitationDto>> (AcceptInvitationRequest request, InvitationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Accept(request, ct))).RequireAuthorization();
    }
}
