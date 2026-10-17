using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Shared;

public sealed class Access(ClockedInDbContext db, CurrentUser current)
{
    private Dictionary<Guid, CallerOrganization>? _organizations;
    private List<CallerDepartment>? _departments;

    public User Caller => current.User;

    public async Task<Organization> RequireOrganization(Guid organizationId, bool admin, CancellationToken cancellationToken)
    {
        var organization = await db.Organizations.Include(item => item.Theme)
            .FirstOrDefaultAsync(item => item.Id == organizationId, cancellationToken) ?? throw ApiException.NotFound();
        if (Caller.IsSuperAdmin)
        {
            return organization;
        }

        var memberships = await Organizations(cancellationToken);
        if (!memberships.TryGetValue(organizationId, out var membership)
            || !membership.IsActive
            || (admin && !membership.IsAdmin))
        {
            throw ApiException.Forbidden();
        }

        return organization;
    }

    public async Task<Department> RequireDepartment(Guid departmentId, CancellationToken cancellationToken)
    {
        var department = await db.Departments.FirstOrDefaultAsync(item => item.Id == departmentId, cancellationToken)
            ?? throw ApiException.NotFound();
        await RequireOrganization(department.OrganizationId, false, cancellationToken);
        return department;
    }

    public async Task<Department> RequireDepartmentManager(Guid departmentId, CancellationToken cancellationToken)
    {
        var department = await db.Departments.FirstOrDefaultAsync(item => item.Id == departmentId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (!Caller.IsSuperAdmin
            && !await IsOrgAdmin(department.OrganizationId, cancellationToken)
            && !await IsDepartmentAdmin(departmentId, cancellationToken))
        {
            throw ApiException.Forbidden();
        }

        return department;
    }

    public async Task<bool> IsOrgAdmin(Guid organizationId, CancellationToken cancellationToken)
    {
        var memberships = await Organizations(cancellationToken);
        return memberships.TryGetValue(organizationId, out var membership) && membership.IsActive && membership.IsAdmin;
    }

    public async Task<bool> IsOrgVolunteer(Guid organizationId, CancellationToken cancellationToken)
    {
        var memberships = await Organizations(cancellationToken);
        return memberships.TryGetValue(organizationId, out var membership) && membership.IsActive && membership.IsVolunteer;
    }

    public async Task<List<Guid>> OrganizationsWhereCallerCanReadOthers(CancellationToken cancellationToken) =>
        (await Organizations(cancellationToken))
            .Where(item => item.Value.IsActive && !item.Value.IsVolunteer)
            .Select(item => item.Key)
            .ToList();

    public async Task<bool> IsDepartmentAdmin(Guid departmentId, CancellationToken cancellationToken)
    {
        var department = (await Departments(cancellationToken)).FirstOrDefault(item => item.DepartmentId == departmentId);
        if (department is null || !department.IsAdmin)
        {
            return false;
        }

        var memberships = await Organizations(cancellationToken);
        return memberships.TryGetValue(department.OrganizationId, out var membership) && membership.IsActive;
    }

    public async Task<List<Guid>> ActiveOrganizationIds(CancellationToken cancellationToken) =>
        (await Organizations(cancellationToken)).Where(item => item.Value.IsActive).Select(item => item.Key).ToList();

    public async Task<List<Guid>> DepartmentIds(CancellationToken cancellationToken) =>
        (await Departments(cancellationToken)).Select(item => item.DepartmentId).ToList();

    public async Task<List<Guid>> SharedOrganizationIds(Guid otherUserId, CancellationToken cancellationToken)
    {
        var callerOrganizations = await ActiveOrganizationIds(cancellationToken);
        return await db.OrganizationMemberships.AsNoTracking()
            .Where(membership => membership.UserId == otherUserId && callerOrganizations.Contains(membership.OrganizationId))
            .Select(membership => membership.OrganizationId)
            .ToListAsync(cancellationToken);
    }

    private async Task<Dictionary<Guid, CallerOrganization>> Organizations(CancellationToken cancellationToken) =>
        _organizations ??= await db.OrganizationMemberships.AsNoTracking()
            .Where(membership => membership.UserId == Caller.Id)
            .ToDictionaryAsync(
                membership => membership.OrganizationId,
                membership => new CallerOrganization(
                    membership.IsActive,
                    membership.RoleId == Role.AdminId,
                    membership.RoleId == Role.VolunteerId),
                cancellationToken);

    private async Task<List<CallerDepartment>> Departments(CancellationToken cancellationToken) =>
        _departments ??= await db.DepartmentMemberships.AsNoTracking()
            .Where(membership => membership.UserId == Caller.Id)
            .Select(membership => new CallerDepartment(
                membership.DepartmentId,
                membership.Department.OrganizationId,
                membership.RoleId == Role.AdminId))
            .ToListAsync(cancellationToken);

    private sealed record CallerOrganization(bool IsActive, bool IsAdmin, bool IsVolunteer);

    private sealed record CallerDepartment(Guid DepartmentId, Guid OrganizationId, bool IsAdmin);
}
