using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Projects;

public sealed class ProjectsService(ClockedInDbContext db, Access access)
{
    public async Task<ListResponse<ProjectDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var caller = access.Caller;
        var projects = db.Projects.AsNoTracking().Include(project => project.Editors)
            .Where(project => project.OrganizationId == organizationId);
        if (!caller.IsSuperAdmin && !await access.IsOrgAdmin(organizationId, cancellationToken))
        {
            var departmentIds = await access.DepartmentIds(cancellationToken);
            projects = projects.Where(project =>
                project.AccessType == AccessType.Public
                || project.OwnerUserId == caller.Id
                || project.Editors.Any(editor => editor.Id == caller.Id)
                || (project.AccessType == AccessType.Department
                    && project.DepartmentId != null
                    && departmentIds.Contains(project.DepartmentId.Value)));
        }

        var items = await projects
            .OrderBy(project => project.Title)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(items.Select(ProjectDto.From).ToList(), page);
    }

    public async Task<ProjectDto> Create(Guid organizationId, CreateProjectRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        await AssertAccessWrite(organizationId, request.AccessType, request.DepartmentId, cancellationToken);
        AssertDates(request.AccessType, request.DepartmentId, request.StartDate, request.EndDate);
        var callerId = access.Caller.Id;
        var editors = await Editors(organizationId, callerId, request.EditorIds, cancellationToken);
        var project = new Project
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            DepartmentId = request.AccessType == AccessType.Department ? request.DepartmentId : null,
            OwnerUserId = callerId,
            Title = request.Title,
            Description = request.Description,
            AccessType = request.AccessType,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            IsActive = request.IsActive,
            Editors = editors,
        };
        db.Projects.Add(project);
        await db.SaveOrThrowAsync(cancellationToken);
        return ProjectDto.From(project);
    }

    public async Task<ProjectDto> Get(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await Load(projectId, cancellationToken);
        await RequireRead(project, cancellationToken);
        return ProjectDto.From(project);
    }

    public async Task<ProjectDto> Update(Guid projectId, UpdateProjectRequest request, CancellationToken cancellationToken)
    {
        var project = await Load(projectId, cancellationToken);
        await AssertManage(project, cancellationToken);
        var accessType = request.AccessType.Or(project.AccessType);
        var departmentId = request.DepartmentId.Or(project.DepartmentId);
        await AssertAccessWrite(project.OrganizationId, accessType, departmentId, cancellationToken);
        var startDate = request.StartDate.Or(project.StartDate);
        var endDate = request.EndDate.Or(project.EndDate);
        AssertDates(accessType, departmentId, startDate, endDate);
        project.Title = request.Title.Or(project.Title);
        project.Description = request.Description.Or(project.Description);
        if (request.AccessType.HasValue || request.DepartmentId.HasValue)
        {
            project.AccessType = accessType;
            project.DepartmentId = accessType == AccessType.Department ? departmentId : null;
        }

        project.StartDate = startDate;
        project.EndDate = endDate;
        project.IsActive = request.IsActive.Or(project.IsActive);
        if (request.EditorIds.HasValue)
        {
            var editors = await Editors(project.OrganizationId, project.OwnerUserId, request.EditorIds.Value, cancellationToken);
            project.Editors.Clear();
            foreach (var editor in editors)
            {
                project.Editors.Add(editor);
            }
        }

        await db.SaveOrThrowAsync(cancellationToken);
        return ProjectDto.From(project);
    }

    public async Task Delete(Guid projectId, CancellationToken cancellationToken)
    {
        var project = await Load(projectId, cancellationToken);
        await AssertManage(project, cancellationToken);
        if (await db.UserTimeEntries.AnyAsync(entry => entry.ProjectId == projectId, cancellationToken)
            || await db.CollectiveTimeEntries.AnyAsync(entry => entry.ProjectId == projectId, cancellationToken))
        {
            throw ApiException.Conflict("Delete the time entries first.");
        }

        db.Projects.Remove(project);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<Project> Load(Guid projectId, CancellationToken cancellationToken) =>
        await db.Projects.Include(project => project.Editors).FirstOrDefaultAsync(project => project.Id == projectId, cancellationToken)
        ?? throw ApiException.NotFound();

    private async Task RequireRead(Project project, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(project.OrganizationId, false, cancellationToken);
        var caller = access.Caller;
        if (caller.IsSuperAdmin
            || await access.IsOrgAdmin(project.OrganizationId, cancellationToken)
            || project.AccessType == AccessType.Public
            || project.OwnerUserId == caller.Id
            || project.Editors.Any(editor => editor.Id == caller.Id))
        {
            return;
        }

        if (project.AccessType == AccessType.Department
            && project.DepartmentId is Guid departmentId
            && (await access.DepartmentIds(cancellationToken)).Contains(departmentId))
        {
            return;
        }

        throw ApiException.Forbidden();
    }

    private async Task AssertManage(Project project, CancellationToken cancellationToken)
    {
        var caller = access.Caller;
        if (caller.IsSuperAdmin
            || await access.IsOrgAdmin(project.OrganizationId, cancellationToken)
            || project.OwnerUserId == caller.Id
            || project.Editors.Any(editor => editor.Id == caller.Id))
        {
            return;
        }

        if (project.AccessType == AccessType.Department
            && project.DepartmentId is Guid departmentId
            && await access.IsDepartmentAdmin(departmentId, cancellationToken))
        {
            return;
        }

        throw ApiException.Forbidden();
    }

    private async Task AssertAccessWrite(Guid organizationId, AccessType accessType, Guid? departmentId, CancellationToken cancellationToken)
    {
        if (accessType != AccessType.Department)
        {
            if (departmentId is not null)
            {
                throw ApiException.Validation("departmentId must be empty when accessType is Public or Private.");
            }

            return;
        }

        if (departmentId is not Guid id)
        {
            throw ApiException.Validation("departmentId is required when accessType is Department.");
        }

        var department = await db.Departments.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw ApiException.NotFound();
        if (department.OrganizationId != organizationId)
        {
            throw ApiException.Validation("departmentId does not belong to this organization.");
        }

        if (!access.Caller.IsSuperAdmin
            && !await access.IsOrgAdmin(organizationId, cancellationToken)
            && !await access.IsDepartmentAdmin(id, cancellationToken))
        {
            throw ApiException.Forbidden();
        }
    }

    private static void AssertDates(AccessType accessType, Guid? departmentId, DateOnly? startDate, DateOnly? endDate)
    {
        if (accessType == AccessType.Department && departmentId is null)
        {
            throw ApiException.Validation("departmentId is required when accessType is Department.");
        }

        if (accessType != AccessType.Department && departmentId is not null)
        {
            throw ApiException.Validation("departmentId must be empty when accessType is Public or Private.");
        }

        if (startDate is DateOnly start && endDate is DateOnly end && end < start)
        {
            throw ApiException.Validation("endDate must be on or after startDate.");
        }
    }

    private async Task<List<User>> Editors(Guid organizationId, Guid ownerUserId, List<Guid> editorIds, CancellationToken cancellationToken)
    {
        var unique = editorIds.Distinct().Where(id => id != ownerUserId).ToList();
        if (unique.Count == 0)
        {
            return [];
        }

        var members = await db.OrganizationMemberships.CountAsync(
            membership => membership.OrganizationId == organizationId && unique.Contains(membership.UserId),
            cancellationToken);
        if (members != unique.Count)
        {
            throw ApiException.Validation("Each editor must be a member of this organization.");
        }

        return await db.Users.Where(user => unique.Contains(user.Id)).ToListAsync(cancellationToken);
    }
}
