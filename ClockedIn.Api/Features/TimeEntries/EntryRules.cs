using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.TimeEntries;

public sealed class EntryRules(ClockedInDbContext db, Access access)
{
    public async Task AssertCanWriteUserEntry(Guid userId, Guid organizationId, Guid? departmentId, CancellationToken cancellationToken)
    {
        if (access.IsApiKey)
        {
            if (!access.CanWrite(organizationId))
            {
                throw ApiException.Forbidden();
            }

            return;
        }

        if (!access.IsSuperAdmin && access.ActorUserId != userId && await access.IsOrgVolunteer(organizationId, cancellationToken))
        {
            throw ApiException.Forbidden();
        }

        if (access.ActorUserId == userId
            || access.IsSuperAdmin
            || await access.IsOrgAdmin(organizationId, cancellationToken)
            || (departmentId is Guid id && await access.IsDepartmentAdmin(id, cancellationToken)))
        {
            return;
        }

        throw ApiException.Forbidden();
    }

    public async Task AssertLogTarget(Guid userId, Guid organizationId, Guid? departmentId, CancellationToken cancellationToken)
    {
        await AssertPlacement(organizationId, departmentId, cancellationToken);
        if (access.IsSuperAdmin)
        {
            return;
        }

        var member = await db.OrganizationMemberships.AnyAsync(
            item => item.UserId == userId && item.OrganizationId == organizationId && item.IsActive,
            cancellationToken);
        if (!member)
        {
            throw ApiException.Forbidden();
        }
    }

    public async Task AssertCollectiveWrite(Guid organizationId, Guid? departmentId, CancellationToken cancellationToken)
    {
        await AssertPlacement(organizationId, departmentId, cancellationToken);
        if (access.IsSuperAdmin
            || access.CanWrite(organizationId)
            || await access.IsOrgAdmin(organizationId, cancellationToken)
            || (departmentId is Guid id && await access.IsDepartmentAdmin(id, cancellationToken)))
        {
            return;
        }

        throw ApiException.Forbidden();
    }

    public async Task AssertProject(Guid workerId, Guid organizationId, Guid? departmentId, Guid projectId, CancellationToken cancellationToken)
    {
        var project = await db.Projects.AsNoTracking().Include(item => item.Editors)
            .FirstOrDefaultAsync(item => item.Id == projectId, cancellationToken) ?? throw ApiException.NotFound();
        if (project.OrganizationId != organizationId)
        {
            throw ApiException.Validation("projectId does not belong to this organization.");
        }

        if (!project.IsActive)
        {
            throw ApiException.Validation("This project is not active.");
        }

        if (project.AccessType == AccessType.Department && (departmentId is null || departmentId != project.DepartmentId))
        {
            throw ApiException.Validation("departmentId must match this department project.");
        }

        if (project.AccessType == AccessType.Private
            && !access.IsSuperAdmin
            && project.OwnerUserId != workerId
            && project.Editors.All(editor => editor.Id != workerId)
            && !access.CanWrite(organizationId)
            && !await access.IsOrgAdmin(organizationId, cancellationToken))
        {
            throw ApiException.Forbidden();
        }
    }

    public async Task AssertTaskCategory(Guid organizationId, Guid taskCategoryId, CancellationToken cancellationToken)
    {
        var categoryOrganization = await db.TaskCategories.Where(item => item.Id == taskCategoryId)
            .Select(item => (Guid?)item.OrganizationId)
            .FirstOrDefaultAsync(cancellationToken) ?? throw ApiException.NotFound();
        if (categoryOrganization != organizationId)
        {
            throw ApiException.Validation("taskCategoryId does not belong to this organization.");
        }
    }

    public async Task<List<Tag>> Tags(Guid organizationId, List<Guid> tagIds, CancellationToken cancellationToken)
    {
        var unique = tagIds.Distinct().ToList();
        if (unique.Count == 0)
        {
            return [];
        }

        var tags = await db.Tags.Where(tag => unique.Contains(tag.Id) && tag.OrganizationId == organizationId).ToListAsync(cancellationToken);
        if (tags.Count != unique.Count)
        {
            throw ApiException.Validation("A tag does not belong to this organization.");
        }

        return tags;
    }

    public async Task<(Guid Id, decimal Rate)> ResolveHourlyRate(
        Guid userId,
        Guid organizationId,
        Guid? hourlyRateId,
        CancellationToken cancellationToken)
    {
        var lockToDefault = !access.IsApiKey && access.ActorUserId == userId && await access.IsOrgVolunteer(organizationId, cancellationToken);
        if (lockToDefault || hourlyRateId is null)
        {
            return await DefaultVolunteerRate(organizationId, cancellationToken);
        }

        var rate = await db.HourlyRates.AsNoTracking().FirstOrDefaultAsync(
            item => item.Id == hourlyRateId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();
        if (rate.IsArchived)
        {
            throw ApiException.Validation("This hourly rate is archived.");
        }

        return (rate.Id, rate.PerHourRate);
    }

    public async Task<(Guid Id, decimal Rate)> DefaultVolunteerRate(Guid organizationId, CancellationToken cancellationToken)
    {
        var rate = await db.HourlyRates.AsNoTracking()
            .Where(item => item.OrganizationId == organizationId && item.IsDefault)
            .Select(item => new { item.Id, item.PerHourRate })
            .FirstOrDefaultAsync(cancellationToken) ?? throw ApiException.Validation("This organization needs a default volunteer rate.");
        return (rate.Id, rate.PerHourRate);
    }

    private async Task AssertPlacement(Guid organizationId, Guid? departmentId, CancellationToken cancellationToken)
    {
        if (!await db.Organizations.AnyAsync(item => item.Id == organizationId, cancellationToken))
        {
            throw ApiException.NotFound();
        }

        if (departmentId is Guid id)
        {
            var departmentOrganization = await db.Departments.Where(item => item.Id == id)
                .Select(item => (Guid?)item.OrganizationId)
                .FirstOrDefaultAsync(cancellationToken) ?? throw ApiException.NotFound();
            if (departmentOrganization != organizationId)
            {
                throw ApiException.Validation("departmentId does not belong to this organization.");
            }
        }
    }
}
