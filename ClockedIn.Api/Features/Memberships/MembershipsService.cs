using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Memberships;

public sealed class MembershipsService(ClockedInDbContext db, Access access, TimeProvider time)
{
    public async Task<ListResponse<RoleDto>> ListRoles(PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        var roles = await db.Roles.AsNoTracking()
            .OrderBy(role => role.Code)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(roles.Select(RoleDto.From).ToList(), page);
    }

    public async Task<ListResponse<MembershipDto>> ListOrganization(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var memberships = await db.OrganizationMemberships.AsNoTracking()
            .Include(membership => membership.Role)
            .Include(membership => membership.User).ThenInclude(user => user.Profile)
            .Where(membership => membership.OrganizationId == organizationId)
            .OrderBy(membership => membership.JoinedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        var departmentIds = await DepartmentIdsByUser(organizationId, memberships.Select(item => item.UserId).ToList(), cancellationToken);
        return ListResponse.Of(memberships.Select(item => MembershipDto.From(item, departmentIds.GetValueOrDefault(item.UserId, []))).ToList(), page);
    }

    public async Task<MembershipDto> CreateOrganization(Guid organizationId, CreateOrgMembershipRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockOrganizationAsync(organizationId, cancellationToken);
        var existing = await db.UsersWithProfile().FirstOrDefaultAsync(user => user.Email == request.Email, cancellationToken);
        User user;
        if (existing is null)
        {
            if (string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.Username))
            {
                throw ApiException.Validation("username and password are required for a new person.");
            }

            user = new User
            {
                Id = Guid.NewGuid(),
                Username = request.Username,
                Email = request.Email,
                PasswordHash = Passwords.Hash(request.Password),
                MustChangePassword = true,
                Profile = new UserProfile
                {
                    Id = Guid.NewGuid(),
                    FirstName = request.FirstName,
                    LastName = request.LastName,
                    DisplayName = request.DisplayName,
                    Timezone = request.Timezone,
                    Phone = request.Phone,
                    ZipCode = request.ZipCode,
                    Notes = request.Notes,
                },
            };
            db.Users.Add(user);
        }
        else
        {
            if (await db.OrganizationMemberships.AnyAsync(item => item.UserId == existing.Id && item.OrganizationId == organizationId, cancellationToken))
            {
                throw ApiException.Conflict("This person is already in the organization.");
            }

            user = existing;
            if (user.Profile is not null)
            {
                user.Profile.FirstName = request.FirstName;
                user.Profile.LastName = request.LastName;
                user.Profile.DisplayName = request.DisplayName ?? user.Profile.DisplayName;
                user.Profile.Timezone = request.Timezone;
                user.Profile.Phone = request.Phone ?? user.Profile.Phone;
                user.Profile.ZipCode = request.ZipCode ?? user.Profile.ZipCode;
                user.Profile.Notes = request.Notes ?? user.Profile.Notes;
            }
        }

        var rateType = await db.Organizations.Where(item => item.Id == organizationId).Select(item => item.DefaultRateType).FirstAsync(cancellationToken);
        var membership = new OrganizationMembership
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            OrganizationId = organizationId,
            RoleId = Role.IdOf(request.Role),
            RateType = rateType,
            IsActive = true,
            JoinedAt = time.UtcNow(),
        };
        db.OrganizationMemberships.Add(membership);
        await SyncDepartments(organizationId, user.Id, request.DepartmentIds, cancellationToken);
        membership.PrimaryDepartmentId = request.DepartmentIds.Count > 0 ? request.DepartmentIds[0] : null;
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return await MapOrganization(membership.Id, cancellationToken);
    }

    public async Task<MembershipDto> UpdateOrganization(
        Guid organizationId,
        Guid membershipId,
        UpdateOrgMembershipRequest request,
        CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockOrganizationAsync(organizationId, cancellationToken);
        var membership = await db.OrganizationMemberships.Include(item => item.User).ThenInclude(user => user.Profile)
            .FirstOrDefaultAsync(item => item.Id == membershipId && item.OrganizationId == organizationId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (request.Role.HasValue)
        {
            var roleId = Role.IdOf(request.Role.Value);
            if (membership.RoleId == Role.AdminId && roleId != Role.AdminId)
            {
                await AssertAnotherAdmin(organizationId, membership.Id, cancellationToken);
            }

            membership.RoleId = roleId;
        }

        membership.RateType = request.RateType.Or(membership.RateType);
        membership.ProfessionalBillingRate = request.ProfessionalBillingRate.Or(membership.ProfessionalBillingRate);
        membership.IsActive = request.IsActive.Or(membership.IsActive);
        if (request.DepartmentIds.HasValue)
        {
            await SyncDepartments(organizationId, membership.UserId, request.DepartmentIds.Value, cancellationToken);
            if (!request.PrimaryDepartmentId.HasValue)
            {
                membership.PrimaryDepartmentId = request.DepartmentIds.Value.Count > 0 ? request.DepartmentIds.Value[0] : null;
            }
        }

        if (request.PrimaryDepartmentId.HasValue)
        {
            if (request.PrimaryDepartmentId.Value is Guid departmentId)
            {
                await AssertDepartment(organizationId, departmentId, "primaryDepartmentId does not belong to this organization.", cancellationToken);
                await EnsureDepartmentMembership(membership.UserId, departmentId, cancellationToken);
            }

            membership.PrimaryDepartmentId = request.PrimaryDepartmentId.Value;
        }

        if (membership.RateType == RateType.Volunteer)
        {
            membership.ProfessionalBillingRate = null;
        }
        else if (membership.ProfessionalBillingRate is null or <= 0)
        {
            throw ApiException.Validation("professionalBillingRate is required when rateType is Professional.");
        }

        if (request.Email.HasValue)
        {
            membership.User.Email = request.Email.Value;
        }

        if (request.FirstName.HasValue
            || request.LastName.HasValue
            || request.DisplayName.HasValue
            || request.Timezone.HasValue
            || request.Phone.HasValue
            || request.ZipCode.HasValue
            || request.Notes.HasValue)
        {
            if (membership.User.Profile is null)
            {
                throw ApiException.NotFound();
            }

            membership.User.Profile.FirstName = request.FirstName.Or(membership.User.Profile.FirstName);
            membership.User.Profile.LastName = request.LastName.Or(membership.User.Profile.LastName);
            membership.User.Profile.DisplayName = request.DisplayName.Or(membership.User.Profile.DisplayName);
            membership.User.Profile.Timezone = request.Timezone.Or(membership.User.Profile.Timezone);
            membership.User.Profile.Phone = request.Phone.Or(membership.User.Profile.Phone);
            membership.User.Profile.ZipCode = request.ZipCode.Or(membership.User.Profile.ZipCode);
            membership.User.Profile.Notes = request.Notes.Or(membership.User.Profile.Notes);
        }

        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return await MapOrganization(membership.Id, cancellationToken);
    }

    public Task DeleteOrganization(Guid organizationId, Guid membershipId, CancellationToken cancellationToken) =>
        DeleteOrganizations(organizationId, [membershipId], cancellationToken);

    public async Task DeleteOrganizations(Guid organizationId, IReadOnlyList<Guid> membershipIds, CancellationToken cancellationToken)
    {
        var ids = membershipIds.Distinct().ToList();
        if (ids.Count == 0)
        {
            throw ApiException.Validation("membershipIds must include at least one id.");
        }

        if (ids.Count > 100)
        {
            throw ApiException.Validation("membershipIds must include at most 100 ids.");
        }

        var orgAdmin = access.IsSuperAdmin || await access.IsOrgAdmin(organizationId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockOrganizationAsync(organizationId, cancellationToken);
        var memberships = await db.OrganizationMemberships.AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && ids.Contains(item.Id))
            .Select(item => new { item.Id, item.UserId, item.RoleId })
            .ToListAsync(cancellationToken);
        if (memberships.Count != ids.Count)
        {
            throw ApiException.NotFound();
        }

        if (!orgAdmin && memberships.Any(item => item.UserId != access.ActorUserId))
        {
            throw ApiException.Forbidden();
        }

        var removingAdmins = memberships.Count(item => item.RoleId == Role.AdminId);
        if (removingAdmins > 0)
        {
            var admins = await db.OrganizationMemberships.CountAsync(
                item => item.OrganizationId == organizationId && item.RoleId == Role.AdminId,
                cancellationToken);
            if (admins - removingAdmins < 1)
            {
                throw ApiException.Conflict("The last organization admin cannot be removed.");
            }
        }

        var userIds = memberships.Select(item => item.UserId).ToList();
        await db.DepartmentMemberships
            .Where(item => userIds.Contains(item.UserId) && item.Department.OrganizationId == organizationId)
            .ExecuteDeleteAsync(cancellationToken);
        await db.OrganizationMemberships
            .Where(item => item.OrganizationId == organizationId && ids.Contains(item.Id))
            .ExecuteDeleteAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    public async Task<ListResponse<MembershipDto>> ListDepartment(Guid departmentId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        var department = await access.RequireDepartment(departmentId, cancellationToken);
        var memberships = await db.DepartmentMemberships.AsNoTracking()
            .Include(membership => membership.Role)
            .Include(membership => membership.User).ThenInclude(user => user.Profile)
            .Where(membership => membership.DepartmentId == departmentId)
            .OrderBy(membership => membership.JoinedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(memberships.Select(item => MembershipDto.From(item, department.OrganizationId)).ToList(), page);
    }

    public async Task<MembershipDto> UpdateDepartment(
        Guid departmentId,
        Guid membershipId,
        UpdateDepartmentMembershipRequest request,
        CancellationToken cancellationToken)
    {
        var department = await access.RequireDepartmentManager(departmentId, cancellationToken);
        var membership = await db.DepartmentMemberships
            .FirstOrDefaultAsync(item => item.Id == membershipId && item.DepartmentId == departmentId, cancellationToken)
            ?? throw ApiException.NotFound();
        membership.RoleId = Role.IdOf(request.Role);
        await db.SaveOrThrowAsync(cancellationToken);
        var saved = await db.DepartmentMemberships.AsNoTracking()
            .Include(item => item.Role)
            .Include(item => item.User).ThenInclude(user => user.Profile)
            .FirstAsync(item => item.Id == membership.Id, cancellationToken);
        return MembershipDto.From(saved, department.OrganizationId);
    }

    public async Task DeleteDepartment(Guid departmentId, Guid membershipId, CancellationToken cancellationToken)
    {
        var membership = await db.DepartmentMemberships.Include(item => item.Department)
            .FirstOrDefaultAsync(item => item.Id == membershipId && item.DepartmentId == departmentId, cancellationToken)
            ?? throw ApiException.NotFound();
        var allowed = access.IsSuperAdmin
            || access.ActorUserId == membership.UserId
            || await access.IsOrgAdmin(membership.Department.OrganizationId, cancellationToken)
            || await access.IsDepartmentAdmin(departmentId, cancellationToken);
        if (!allowed)
        {
            throw ApiException.Forbidden();
        }

        db.DepartmentMemberships.Remove(membership);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task AssertAnotherAdmin(Guid organizationId, Guid exceptMembershipId, CancellationToken cancellationToken)
    {
        var another = await db.OrganizationMemberships.AnyAsync(
            item => item.OrganizationId == organizationId && item.RoleId == Role.AdminId && item.Id != exceptMembershipId,
            cancellationToken);
        if (!another)
        {
            throw ApiException.Conflict("The last organization admin cannot be removed.");
        }
    }

    private async Task<MembershipDto> MapOrganization(Guid membershipId, CancellationToken cancellationToken)
    {
        var membership = await db.OrganizationMemberships.AsNoTracking()
            .Include(item => item.Role)
            .Include(item => item.User).ThenInclude(user => user.Profile)
            .FirstAsync(item => item.Id == membershipId, cancellationToken);
        var departmentIds = await DepartmentIdsByUser(membership.OrganizationId, [membership.UserId], cancellationToken);
        return MembershipDto.From(membership, departmentIds.GetValueOrDefault(membership.UserId, []));
    }

    private async Task<Dictionary<Guid, List<Guid>>> DepartmentIdsByUser(
        Guid organizationId,
        List<Guid> userIds,
        CancellationToken cancellationToken)
    {
        if (userIds.Count == 0)
        {
            return [];
        }

        var rows = await db.DepartmentMemberships.AsNoTracking()
            .Where(item => userIds.Contains(item.UserId) && item.Department.OrganizationId == organizationId)
            .Select(item => new { item.UserId, item.DepartmentId })
            .ToListAsync(cancellationToken);
        return rows
            .GroupBy(row => row.UserId)
            .ToDictionary(group => group.Key, group => group.Select(row => row.DepartmentId).ToList());
    }

    private async Task SyncDepartments(Guid organizationId, Guid userId, List<Guid> departmentIds, CancellationToken cancellationToken)
    {
        var unique = departmentIds.Distinct().ToList();
        foreach (var departmentId in unique)
        {
            await AssertDepartment(organizationId, departmentId, "departmentIds must belong to this organization.", cancellationToken);
        }

        var existing = await db.DepartmentMemberships
            .Where(item => item.UserId == userId && item.Department.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);
        foreach (var membership in existing.Where(item => !unique.Contains(item.DepartmentId)))
        {
            db.DepartmentMemberships.Remove(membership);
        }

        var keep = existing.Select(item => item.DepartmentId).ToHashSet();
        foreach (var departmentId in unique.Where(id => !keep.Contains(id)))
        {
            db.DepartmentMemberships.Add(new DepartmentMembership
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DepartmentId = departmentId,
                RoleId = Role.MemberId,
                JoinedAt = time.UtcNow(),
            });
        }
    }

    private async Task EnsureDepartmentMembership(Guid userId, Guid departmentId, CancellationToken cancellationToken)
    {
        if (await db.DepartmentMemberships.AnyAsync(item => item.UserId == userId && item.DepartmentId == departmentId, cancellationToken))
        {
            return;
        }

        db.DepartmentMemberships.Add(new DepartmentMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            DepartmentId = departmentId,
            RoleId = Role.MemberId,
            JoinedAt = time.UtcNow(),
        });
    }

    private async Task AssertDepartment(Guid organizationId, Guid departmentId, string message, CancellationToken cancellationToken)
    {
        var department = await db.Departments.AsNoTracking().FirstOrDefaultAsync(item => item.Id == departmentId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (department.OrganizationId != organizationId)
        {
            throw ApiException.Validation(message);
        }
    }
}
