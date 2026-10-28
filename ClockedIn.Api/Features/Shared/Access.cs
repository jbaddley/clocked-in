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
    private Dictionary<Guid, HashSet<string>>? _permissions;

    public bool IsApiKey => current.IsApiKey;

    public bool IsPlatformKey => current.ApiKey?.IsPlatform == true;

    public bool IsSuperAdmin => current.IsSuperAdmin;

    public User Caller => current.User;

    public Guid ActorUserId => current.UserOrNull?.Id
        ?? current.ApiKey?.CreatedByUserId
        ?? throw ApiException.Unauthorized();

    public User RequireHuman() => current.UserOrNull ?? throw ApiException.Forbidden();

    public User RequireSuperAdmin()
    {
        var user = RequireHuman();
        if (!user.IsSuperAdmin)
        {
            throw ApiException.Forbidden();
        }

        return user;
    }

    public bool CanWrite(Guid organizationId) =>
        current.ApiKey is { } key && key.CanWrite && (key.IsPlatform || key.OrganizationId == organizationId);

    public async Task<Organization> RequireOrganization(Guid organizationId, bool admin, CancellationToken cancellationToken)
    {
        var organization = await db.Organizations.Include(item => item.Theme)
            .FirstOrDefaultAsync(item => item.Id == organizationId, cancellationToken) ?? throw ApiException.NotFound();
        if (current.ApiKey is { } key)
        {
            if (!key.IsPlatform && key.OrganizationId != organizationId)
            {
                throw ApiException.Forbidden();
            }

            if (admin ? !key.CanWrite : !key.CanRead)
            {
                throw ApiException.Forbidden();
            }

            return organization;
        }

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

    public async Task<Organization> RequireOrganizationAdmin(Guid organizationId, CancellationToken cancellationToken)
    {
        var organization = await RequireOrganization(organizationId, true, cancellationToken);
        if (current.ApiKey is { } key && !key.IsAdmin)
        {
            throw ApiException.Forbidden();
        }

        return organization;
    }

    /// <summary>Saving report designs: an admin API key, or a person with manage_organization or design_reports.</summary>
    public async Task<Organization> RequireReportDesigner(Guid organizationId, CancellationToken cancellationToken)
    {
        if (current.ApiKey is not null)
        {
            return await RequireOrganizationAdmin(organizationId, cancellationToken);
        }

        var organization = await RequireOrganization(organizationId, false, cancellationToken);
        if (!await Can(organizationId, "manage_organization", cancellationToken) && !await Can(organizationId, "design_reports", cancellationToken))
        {
            throw ApiException.Forbidden();
        }

        return organization;
    }

    public async Task<Organization> RequirePermission(Guid organizationId, string permission, CancellationToken cancellationToken) =>
        await RequirePermission(organizationId, permission, null, cancellationToken);

    public async Task<Organization> RequirePermission(
        Guid organizationId,
        string permission,
        Guid? departmentId,
        CancellationToken cancellationToken)
    {
        var organization = await RequireOrganization(organizationId, false, cancellationToken);
        if (!await Can(organizationId, permission, departmentId, cancellationToken))
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
        if (!IsSuperAdmin
            && !await IsOrgAdmin(department.OrganizationId, cancellationToken)
            && !await IsDepartmentAdmin(departmentId, cancellationToken))
        {
            throw ApiException.Forbidden();
        }

        return department;
    }

    public async Task<bool> Can(Guid organizationId, string permission, CancellationToken cancellationToken) =>
        await Can(organizationId, permission, null, cancellationToken);

    public async Task<bool> Can(Guid organizationId, string permission, Guid? departmentId, CancellationToken cancellationToken)
    {
        if (IsSuperAdmin)
        {
            return true;
        }

        if (current.ApiKey is { } key)
        {
            if (!key.IsPlatform && key.OrganizationId != organizationId)
            {
                return false;
            }

            return Permissions.ForApiKey(key.IsAdmin, key.CanWrite).Contains(permission);
        }

        var granted = await PermissionsFor(organizationId, cancellationToken);
        if (!granted.Contains(permission))
        {
            return false;
        }

        if (departmentId is Guid id && Permissions.GroupManager.Contains(permission))
        {
            var memberships = await Organizations(cancellationToken);
            if (memberships.TryGetValue(organizationId, out var membership) && !membership.IsAdmin)
            {
                return await IsDepartmentAdmin(id, cancellationToken);
            }
        }

        return true;
    }

    public async Task<HashSet<string>> PermissionsFor(Guid organizationId, CancellationToken cancellationToken)
    {
        _permissions ??= [];
        if (_permissions.TryGetValue(organizationId, out var cached))
        {
            return cached;
        }

        if (IsSuperAdmin)
        {
            return _permissions[organizationId] = [..Permissions.All];
        }

        if (current.ApiKey is { } key)
        {
            return _permissions[organizationId] = [..Permissions.ForApiKey(key.IsAdmin, key.CanWrite)];
        }

        var memberships = await Organizations(cancellationToken);
        if (!memberships.TryGetValue(organizationId, out var membership) || !membership.IsActive)
        {
            return _permissions[organizationId] = [];
        }

        var granted = Permissions.DefaultForCode(membership.Code).ToHashSet();
        if (membership.RoleId is Guid roleId)
        {
            var rows = await db.RolePermissions.AsNoTracking()
                .Where(item => item.RoleId == roleId && item.Allowed)
                .Select(item => item.Permission)
                .ToListAsync(cancellationToken);
            if (rows.Count > 0)
            {
                granted.Clear();
                foreach (var permission in rows.Where(Permissions.IsKnown))
                {
                    granted.Add(permission);
                }
            }
        }

        if ((await AdminDepartmentIds(organizationId, cancellationToken)).Count > 0)
        {
            foreach (var permission in Permissions.GroupManager)
            {
                granted.Add(permission);
            }
        }

        return _permissions[organizationId] = granted;
    }

    public async Task<bool> IsOrgAdmin(Guid organizationId, CancellationToken cancellationToken)
    {
        if (current.ApiKey is { } key)
        {
            return key.IsAdmin && (key.IsPlatform || key.OrganizationId == organizationId);
        }

        var memberships = await Organizations(cancellationToken);
        return memberships.TryGetValue(organizationId, out var membership) && membership.IsActive && membership.IsAdmin;
    }

    public async Task<bool> IsOrgVolunteer(Guid organizationId, CancellationToken cancellationToken)
    {
        if (current.ApiKey is not null)
        {
            return false;
        }

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

    public async Task<string> RoleScope(Guid organizationId, CancellationToken cancellationToken)
    {
        var memberships = await Organizations(cancellationToken);
        return memberships.TryGetValue(organizationId, out var membership)
            ? membership.Scope
            : Permissions.DefaultScopeForCode(null);
    }

    public async Task<List<Guid>> AssignedDepartmentIds(Guid organizationId, CancellationToken cancellationToken)
    {
        var memberships = await Organizations(cancellationToken);
        if (!memberships.TryGetValue(organizationId, out var membership) || !membership.IsActive)
        {
            return [];
        }

        return (await Departments(cancellationToken))
            .Where(item => item.OrganizationId == organizationId)
            .Select(item => item.DepartmentId)
            .ToList();
    }

    public async Task<List<Guid>> AdminDepartmentIds(Guid organizationId, CancellationToken cancellationToken)
    {
        var memberships = await Organizations(cancellationToken);
        if (!memberships.TryGetValue(organizationId, out var membership) || !membership.IsActive)
        {
            return [];
        }

        return (await Departments(cancellationToken))
            .Where(item => item.OrganizationId == organizationId && item.IsAdmin)
            .Select(item => item.DepartmentId)
            .ToList();
    }

    public async Task<CallerVisibility> Visibility(Guid organizationId, CancellationToken cancellationToken)
    {
        if (IsSuperAdmin || IsApiKey || await IsOrgAdmin(organizationId, cancellationToken))
        {
            return CallerVisibility.All;
        }

        var scope = await RoleScope(organizationId, cancellationToken);
        if (scope == "assigned_groups")
        {
            return CallerVisibility.Departments(await AssignedDepartmentIds(organizationId, cancellationToken));
        }

        var adminDepartments = await AdminDepartmentIds(organizationId, cancellationToken);
        if (adminDepartments.Count > 0)
        {
            return CallerVisibility.Departments(adminDepartments);
        }

        if (scope == "self" || await IsOrgVolunteer(organizationId, cancellationToken))
        {
            return CallerVisibility.Self;
        }

        return CallerVisibility.All;
    }

    public async Task<List<Guid>> SharedOrganizationIds(Guid otherUserId, CancellationToken cancellationToken)
    {
        var callerOrganizations = await ActiveOrganizationIds(cancellationToken);
        return await db.OrganizationMemberships.AsNoTracking()
            .Where(membership => membership.UserId == otherUserId && callerOrganizations.Contains(membership.OrganizationId))
            .Select(membership => membership.OrganizationId)
            .ToListAsync(cancellationToken);
    }

    private async Task<Dictionary<Guid, CallerOrganization>> Organizations(CancellationToken cancellationToken)
    {
        if (_organizations is not null)
        {
            return _organizations;
        }

        if (current.ApiKey is { } key)
        {
            if (key.IsPlatform)
            {
                return _organizations = await db.Organizations.AsNoTracking()
                    .ToDictionaryAsync(
                        organization => organization.Id,
                        _ => new CallerOrganization(true, key.IsAdmin, false, null, key.IsAdmin ? "ADMIN" : "MEMBER", "organization"),
                        cancellationToken);
            }

            return _organizations = new Dictionary<Guid, CallerOrganization>
            {
                [key.OrganizationId!.Value] = new(true, key.IsAdmin, false, null, key.IsAdmin ? "ADMIN" : "MEMBER", "organization"),
            };
        }

        return _organizations = await db.OrganizationMemberships.AsNoTracking()
            .Where(membership => membership.UserId == Caller.Id)
            .Select(membership => new
            {
                membership.OrganizationId,
                membership.IsActive,
                membership.RoleId,
                membership.Role.Code,
                membership.Role.Scope,
            })
            .ToDictionaryAsync(
                membership => membership.OrganizationId,
                membership => new CallerOrganization(
                    membership.IsActive,
                    membership.RoleId == Role.AdminId || membership.Code == "ADMIN",
                    membership.RoleId == Role.VolunteerId || membership.Code == "VOLUNTEER",
                    membership.RoleId,
                    membership.Code,
                    string.IsNullOrWhiteSpace(membership.Scope)
                        ? Permissions.DefaultScopeForCode(membership.Code)
                        : membership.Scope),
                cancellationToken);
    }

    private async Task<List<CallerDepartment>> Departments(CancellationToken cancellationToken)
    {
        if (_departments is not null)
        {
            return _departments;
        }

        if (current.ApiKey is { } key)
        {
            var platform = key.IsPlatform;
            var organizationId = key.OrganizationId;
            return _departments = await db.Departments.AsNoTracking()
                .Where(department => platform || department.OrganizationId == organizationId)
                .Select(department => new CallerDepartment(department.Id, department.OrganizationId, key.CanWrite))
                .ToListAsync(cancellationToken);
        }

        return _departments = await db.DepartmentMemberships.AsNoTracking()
            .Where(membership => membership.UserId == Caller.Id)
            .Select(membership => new CallerDepartment(
                membership.DepartmentId,
                membership.Department.OrganizationId,
                membership.RoleId == Role.AdminId))
            .ToListAsync(cancellationToken);
    }

    private sealed record CallerOrganization(
        bool IsActive,
        bool IsAdmin,
        bool IsVolunteer,
        Guid? RoleId,
        string Code,
        string Scope);

    private sealed record CallerDepartment(Guid DepartmentId, Guid OrganizationId, bool IsAdmin);
}

public readonly record struct CallerVisibility(string Kind, IReadOnlyList<Guid> DepartmentIds)
{
    public static CallerVisibility All => new("all", []);

    public static CallerVisibility Self => new("self", []);

    public static CallerVisibility Departments(IReadOnlyList<Guid> departmentIds) => new("departments", departmentIds);

    public bool IsAll => Kind == "all";

    public bool IsSelf => Kind == "self";

    public bool IsDepartments => Kind == "departments";
}
