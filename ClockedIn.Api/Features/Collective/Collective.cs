using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Features.TimeEntries;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Collective;

public sealed record CollectiveEntryDto(
    Guid Id,
    Guid RecordedByUserId,
    Guid OrganizationId,
    Guid? DepartmentId,
    Guid ProjectId,
    Guid TaskCategoryId,
    Guid? HourlyRateId,
    DateTime StartedAt,
    DateTime EndedAt,
    int ParticipantCount,
    string? Description,
    decimal HourlyRate,
    decimal InKindValue,
    DateTime CreatedAt,
    Guid[] TagIds)
{
    public static CollectiveEntryDto From(CollectiveTimeEntry entry) => new(
        entry.Id,
        entry.RecordedByUserId,
        entry.OrganizationId,
        entry.DepartmentId,
        entry.ProjectId,
        entry.TaskCategoryId,
        entry.HourlyRateId,
        entry.StartedAt,
        entry.EndedAt,
        entry.ParticipantCount,
        entry.Description,
        entry.HourlyRate,
        entry.InKindValue,
        entry.CreatedAt,
        entry.Tags.Select(tag => tag.Id).Order().ToArray());
}

public sealed record CreateCollectiveRequest(
    Guid OrganizationId,
    Guid? DepartmentId,
    Guid ProjectId,
    Guid TaskCategoryId,
    DateTime StartedAt,
    DateTime EndedAt,
    int ParticipantCount,
    string? Description,
    List<Guid> TagIds,
    Guid? HourlyRateId)
{
    public static async ValueTask<CreateCollectiveRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        var organizationId = Fields.RequiredGuid(body, "organizationId");
        var departmentId = Fields.OptionalGuid(body, "departmentId");
        var projectId = Fields.RequiredGuid(body, "projectId");
        var taskCategoryId = Fields.RequiredGuid(body, "taskCategoryId");
        var startedAt = Fields.RequiredInstant(body, "startedAt");
        var endedAt = Fields.RequiredInstant(body, "endedAt");
        var participantCount = Fields.RequiredInt(body, "participantCount");
        var description = Fields.OptionalDescription(body);
        CollectiveRules.AssertSpan(startedAt, endedAt, participantCount);
        var tagIds = Fields.Ids(body, "tagIds", optional: true);
        var hourlyRateId = Fields.Has(body, "hourlyRateId") ? Fields.OptionalGuid(body, "hourlyRateId") : null;
        return new CreateCollectiveRequest(organizationId, departmentId, projectId, taskCategoryId, startedAt, endedAt, participantCount, description, tagIds, hourlyRateId);
    }
}

public sealed record UpdateCollectiveRequest(
    Optional<Guid> OrganizationId,
    Optional<Guid?> DepartmentId,
    Optional<Guid> ProjectId,
    Optional<Guid> TaskCategoryId,
    Optional<Guid?> HourlyRateId,
    Optional<DateTime> StartedAt,
    Optional<DateTime> EndedAt,
    Optional<int> ParticipantCount,
    Optional<string?> Description,
    Optional<List<Guid>> TagIds)
{
    public static async ValueTask<UpdateCollectiveRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        return new UpdateCollectiveRequest(
            Optional.Read(body, "organizationId", Fields.RequiredGuid),
            Optional.Read(body, "departmentId", Fields.OptionalGuid),
            Optional.Read(body, "projectId", Fields.RequiredGuid),
            Optional.Read(body, "taskCategoryId", Fields.RequiredGuid),
            Optional.Read(body, "hourlyRateId", Fields.OptionalGuid),
            Optional.Read(body, "startedAt", Fields.RequiredInstant),
            Optional.Read(body, "endedAt", Fields.RequiredInstant),
            Optional.Read(body, "participantCount", Fields.RequiredInt),
            Optional.Read(body, "description", (b, k) => Fields.Description(Fields.OptionalString(b, k))),
            Optional.Read(body, "tagIds", (b, k) => Fields.Ids(b, k, optional: false)));
    }
}

public static class CollectiveRules
{
    public static void AssertSpan(DateTime startedAt, DateTime endedAt, int participantCount)
    {
        if (endedAt <= startedAt)
        {
            throw ApiException.Validation("endedAt must be after startedAt.");
        }

        if (participantCount < 1)
        {
            throw ApiException.Validation("participantCount must be at least 1.");
        }
    }
}

public sealed class CollectiveService(ClockedInDbContext db, Access access, EntryRules rules, TimeProvider time)
{
    public async Task<ListResponse<CollectiveEntryDto>> List(CollectiveFilter filter, CancellationToken cancellationToken)
    {
        var page = Fields.Page(filter.Limit, filter.Offset);
        var organizationId = Fields.QueryGuid(filter.OrganizationId, "organizationId");
        var departmentId = Fields.QueryGuid(filter.DepartmentId, "departmentId");
        if (organizationId is Guid orgId)
        {
            await access.RequireOrganization(orgId, false, cancellationToken);
        }

        if (departmentId is Guid depId)
        {
            var department = await access.RequireDepartment(depId, cancellationToken);
            if (organizationId is Guid expected && department.OrganizationId != expected)
            {
                throw ApiException.Validation("departmentId does not belong to this organization.");
            }
        }

        var organizationIds = !access.IsSuperAdmin && organizationId is null
            ? await access.ActiveOrganizationIds(cancellationToken)
            : null;
        List<Guid>? scopedDepartments = null;
        Guid? recordedByUserId = null;
        if (organizationId is Guid scopedOrganization && departmentId is null)
        {
            var visibility = await access.Visibility(scopedOrganization, cancellationToken);
            if (visibility.IsDepartments)
            {
                scopedDepartments = visibility.DepartmentIds.ToList();
            }
            else if (visibility.IsSelf)
            {
                recordedByUserId = access.ActorUserId;
            }
        }

        var entries = await db.CollectiveTimeEntries.AsNoTracking().Include(entry => entry.Tags)
            .Where(entry => organizationId == null || entry.OrganizationId == organizationId)
            .Where(entry => organizationIds == null || organizationIds.Contains(entry.OrganizationId))
            .Where(entry => departmentId == null || entry.DepartmentId == departmentId)
            .Where(entry => scopedDepartments == null || (entry.DepartmentId != null && scopedDepartments.Contains(entry.DepartmentId.Value)))
            .Where(entry => recordedByUserId == null || entry.RecordedByUserId == recordedByUserId)
            .OrderByDescending(entry => entry.StartedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(entries.Select(CollectiveEntryDto.From).ToList(), page);
    }

    public async Task<CollectiveEntryDto> Create(CreateCollectiveRequest request, CancellationToken cancellationToken)
    {
        var callerId = access.ActorUserId;
        await rules.AssertCollectiveWrite(request.OrganizationId, request.DepartmentId, cancellationToken);
        await rules.AssertProject(callerId, request.OrganizationId, request.DepartmentId, request.ProjectId, cancellationToken);
        await rules.AssertTaskCategory(request.OrganizationId, request.TaskCategoryId, cancellationToken);
        var tags = await rules.Tags(request.OrganizationId, request.TagIds, cancellationToken);
        var (hourlyRateId, hourlyRate) = await rules.ResolveHourlyRate(callerId, request.OrganizationId, request.HourlyRateId, cancellationToken);
        var entry = new CollectiveTimeEntry
        {
            Id = Guid.NewGuid(),
            RecordedByUserId = callerId,
            OrganizationId = request.OrganizationId,
            DepartmentId = request.DepartmentId,
            ProjectId = request.ProjectId,
            TaskCategoryId = request.TaskCategoryId,
            HourlyRateId = hourlyRateId,
            StartedAt = request.StartedAt,
            EndedAt = request.EndedAt,
            ParticipantCount = request.ParticipantCount,
            Description = request.Description,
            HourlyRate = hourlyRate,
            InKindValue = Fields.CollectiveInKind(request.StartedAt, request.EndedAt, request.ParticipantCount, hourlyRate),
            CreatedAt = time.UtcNow(),
            Tags = tags,
        };
        db.CollectiveTimeEntries.Add(entry);
        await db.SaveOrThrowAsync(cancellationToken);
        return CollectiveEntryDto.From(entry);
    }

    public async Task<CollectiveEntryDto> Get(Guid entryId, CancellationToken cancellationToken)
    {
        var entry = await Load(entryId, cancellationToken);
        await access.RequireOrganization(entry.OrganizationId, false, cancellationToken);
        return CollectiveEntryDto.From(entry);
    }

    public async Task<CollectiveEntryDto> Update(Guid entryId, UpdateCollectiveRequest request, CancellationToken cancellationToken)
    {
        var existing = await Load(entryId, cancellationToken);
        if (request.OrganizationId.HasValue && request.OrganizationId.Value != existing.OrganizationId)
        {
            throw ApiException.Validation("organizationId cannot change.");
        }

        var departmentId = request.DepartmentId.Or(existing.DepartmentId);
        var projectId = request.ProjectId.Or(existing.ProjectId);
        var taskCategoryId = request.TaskCategoryId.Or(existing.TaskCategoryId);
        var startedAt = request.StartedAt.Or(existing.StartedAt);
        var endedAt = request.EndedAt.Or(existing.EndedAt);
        var participantCount = request.ParticipantCount.Or(existing.ParticipantCount);
        CollectiveRules.AssertSpan(startedAt, endedAt, participantCount);
        await rules.AssertCollectiveWrite(existing.OrganizationId, departmentId, cancellationToken);
        await rules.AssertProject(access.ActorUserId, existing.OrganizationId, departmentId, projectId, cancellationToken);
        await rules.AssertTaskCategory(existing.OrganizationId, taskCategoryId, cancellationToken);
        existing.DepartmentId = departmentId;
        existing.ProjectId = projectId;
        existing.TaskCategoryId = taskCategoryId;
        if (request.HourlyRateId.HasValue)
        {
            var resolved = await rules.ResolveHourlyRate(access.ActorUserId, existing.OrganizationId, request.HourlyRateId.Value, cancellationToken);
            existing.HourlyRateId = resolved.Id;
            existing.HourlyRate = resolved.Rate;
        }

        existing.StartedAt = startedAt;
        existing.EndedAt = endedAt;
        existing.ParticipantCount = participantCount;
        existing.Description = request.Description.Or(existing.Description);
        existing.InKindValue = Fields.CollectiveInKind(startedAt, endedAt, participantCount, existing.HourlyRate);
        if (request.TagIds.HasValue)
        {
            var tags = await rules.Tags(existing.OrganizationId, request.TagIds.Value, cancellationToken);
            existing.Tags.Clear();
            foreach (var tag in tags)
            {
                existing.Tags.Add(tag);
            }
        }

        await db.SaveOrThrowAsync(cancellationToken);
        return CollectiveEntryDto.From(existing);
    }

    public async Task Delete(Guid entryId, CancellationToken cancellationToken)
    {
        var entry = await Load(entryId, cancellationToken);
        await rules.AssertCollectiveWrite(entry.OrganizationId, entry.DepartmentId, cancellationToken);
        db.CollectiveTimeEntries.Remove(entry);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<CollectiveTimeEntry> Load(Guid entryId, CancellationToken cancellationToken) =>
        await db.CollectiveTimeEntries.Include(entry => entry.Tags).FirstOrDefaultAsync(entry => entry.Id == entryId, cancellationToken)
        ?? throw ApiException.NotFound();
}

public static class CollectiveEndpoints
{
    public static void MapCollectiveEndpoints(this IEndpointRouteBuilder app)
    {
        var entries = app.MapGroup("/collective-time-entries").RequireAuthorization();
        entries.MapGet("", async Task<Ok<ListResponse<CollectiveEntryDto>>> ([AsParameters] CollectiveFilter filter, CollectiveService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(filter, ct)));
        entries.MapPost("", async Task<Created<CollectiveEntryDto>> (CreateCollectiveRequest request, CollectiveService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(request, ct)));
        entries.MapGet("/{id:guid}", async Task<Ok<CollectiveEntryDto>> (Guid id, CollectiveService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        entries.MapPatch("/{id:guid}", async Task<Ok<CollectiveEntryDto>> (Guid id, UpdateCollectiveRequest request, CollectiveService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        entries.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, CollectiveService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
