using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Connections;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.TimeEntries;

public sealed class TimeEntriesService(ClockedInDbContext db, Access access, EntryRules rules, TimeProvider time, ConnectionsService connections)
{
    public async Task<ListResponse<TimeEntryDto>> List(Guid userId, TimeEntryFilter filter, CancellationToken cancellationToken)
    {
        var page = Fields.Page(filter.Limit, filter.Offset);
        var organizationId = Fields.QueryGuid(filter.OrganizationId, "organizationId");
        var departmentId = Fields.QueryGuid(filter.DepartmentId, "departmentId");
        var from = Fields.QueryDate(filter.From, "from");
        var to = Fields.QueryDate(filter.To, "to");
        List<Guid>? visible = null;
        if (access.IsApiKey)
        {
            visible = await access.ActiveOrganizationIds(cancellationToken);
        }
        else if (access.ActorUserId != userId && !access.IsSuperAdmin)
        {
            var shared = await access.SharedOrganizationIds(userId, cancellationToken);
            var readable = await access.OrganizationsWhereCallerCanReadOthers(cancellationToken);
            var connected = await connections.VolunteerConnectedOrganizationIds(userId, cancellationToken);
            visible = shared.Where(id => readable.Contains(id) || connected.Contains(id)).ToList();
            if (visible.Count == 0)
            {
                throw ApiException.Forbidden();
            }
        }

        if (!await db.Users.AnyAsync(user => user.Id == userId, cancellationToken))
        {
            throw ApiException.NotFound();
        }

        if (visible is not null && organizationId is Guid filtered && !visible.Contains(filtered))
        {
            throw ApiException.Forbidden();
        }

        var entries = await db.UserTimeEntries.AsNoTracking().Include(entry => entry.Tags)
            .Where(entry => entry.UserId == userId)
            .Where(entry => visible == null || visible.Contains(entry.OrganizationId))
            .Where(entry => organizationId == null || entry.OrganizationId == organizationId)
            .Where(entry => departmentId == null || entry.DepartmentId == departmentId)
            .Where(entry => from == null || entry.OccurredOn >= from)
            .Where(entry => to == null || entry.OccurredOn <= to)
            .OrderByDescending(entry => entry.OccurredOn)
            .ThenByDescending(entry => entry.StartedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(entries.Select(TimeEntryDto.From).ToList(), page);
    }

    public async Task<ListResponse<TimeEntryDto>> ListForOrganization(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var entries = await db.UserTimeEntries.AsNoTracking().Include(entry => entry.Tags)
            .Where(entry => entry.OrganizationId == organizationId)
            .OrderByDescending(entry => entry.OccurredOn)
            .ThenByDescending(entry => entry.StartedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(entries.Select(TimeEntryDto.From).ToList(), page);
    }

    public async Task<TimeEntryDto> Create(Guid userId, CreateTimeEntryRequest request, CancellationToken cancellationToken)
    {
        var user = await db.UsersWithProfile().FirstOrDefaultAsync(item => item.Id == userId, cancellationToken)
            ?? throw ApiException.NotFound();
        var placement = request.Placement;
        await rules.AssertCanWriteUserEntry(userId, placement.OrganizationId, placement.DepartmentId, cancellationToken);
        await rules.AssertLogTarget(userId, placement.OrganizationId, placement.DepartmentId, cancellationToken);
        await rules.AssertProject(userId, placement.OrganizationId, placement.DepartmentId, placement.ProjectId, cancellationToken);
        await rules.AssertTaskCategory(placement.OrganizationId, placement.TaskCategoryId, cancellationToken);
        var tags = await rules.Tags(placement.OrganizationId, placement.TagIds, cancellationToken);
        var (hourlyRateId, hourlyRate) = await rules.ResolveHourlyRate(userId, placement.OrganizationId, request.HourlyRateId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockUserAsync(userId, cancellationToken);
        var entry = NewEntry(userId, placement, request.Mode, hourlyRateId, hourlyRate, tags);
        if (request.Punch is { } punch)
        {
            var times = PunchTimes(user, punch.StartedAt ?? time.UtcNowToSecond(), punch);
            if (times.EndedAt is null && await HasOpenPunch(userId, cancellationToken))
            {
                throw ApiException.Conflict("You already have an open punch.");
            }

            entry.StartedAt = times.StartedAt;
            entry.EndedAt = times.EndedAt;
            entry.DurationMinutes = times.DurationMinutes;
            entry.OccurredOn = times.OccurredOn;
            entry.InKindValue = times.DurationMinutes is int minutes ? Fields.InKindFromMinutes(minutes, hourlyRate) : null;
        }
        else
        {
            var times = request.Times!;
            entry.StartedAt = times.StartedAt;
            entry.EndedAt = times.EndedAt;
            entry.DurationMinutes = times.DurationMinutes;
            entry.OccurredOn = times.OccurredOn;
            entry.InKindValue = Fields.InKindFromMinutes(times.DurationMinutes, hourlyRate);
        }

        db.UserTimeEntries.Add(entry);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return TimeEntryDto.From(entry);
    }

    public async Task<TimeEntryDto> Get(Guid entryId, CancellationToken cancellationToken) =>
        TimeEntryDto.From(await Owned(entryId, false, cancellationToken));

    public async Task<TimeEntryDto> Update(Guid entryId, UpdateTimeEntryRequest request, CancellationToken cancellationToken)
    {
        var existing = await Owned(entryId, true, cancellationToken);
        var organizationId = request.OrganizationId.Or(existing.OrganizationId);
        var departmentId = request.DepartmentId.Or(existing.DepartmentId);
        var projectId = request.ProjectId.Or(existing.ProjectId);
        var taskCategoryId = request.TaskCategoryId.Or(existing.TaskCategoryId);
        await rules.AssertCanWriteUserEntry(existing.UserId, organizationId, departmentId, cancellationToken);
        await rules.AssertLogTarget(existing.UserId, organizationId, departmentId, cancellationToken);
        await rules.AssertProject(existing.UserId, organizationId, departmentId, projectId, cancellationToken);
        await rules.AssertTaskCategory(organizationId, taskCategoryId, cancellationToken);
        var tags = request.TagIds.HasValue ? await rules.Tags(organizationId, request.TagIds.Value, cancellationToken) : null;
        if (organizationId != existing.OrganizationId && tags is null && existing.Tags.Any(tag => tag.OrganizationId != organizationId))
        {
            throw ApiException.Validation("A tag does not belong to this organization.");
        }

        if (request.HourlyRateId.HasValue || organizationId != existing.OrganizationId)
        {
            var hourlyRateId = request.HourlyRateId.HasValue
                ? request.HourlyRateId.Value
                : organizationId == existing.OrganizationId ? existing.HourlyRateId : null;
            var resolved = await rules.ResolveHourlyRate(existing.UserId, organizationId, hourlyRateId, cancellationToken);
            existing.HourlyRateId = resolved.Id;
            existing.HourlyRate = resolved.Rate;
            if (existing.Mode == TimeEntryMode.Punch && existing.DurationMinutes is int punchMinutes)
            {
                existing.InKindValue = Fields.InKindFromMinutes(punchMinutes, existing.HourlyRate);
            }
        }

        existing.OrganizationId = organizationId;
        existing.DepartmentId = departmentId;
        existing.ProjectId = projectId;
        existing.TaskCategoryId = taskCategoryId;
        existing.Description = request.Description.Or(existing.Description);
        if (request.Times.Any)
        {
            var organization = await db.Organizations.AsNoTracking()
                .FirstAsync(item => item.Id == organizationId, cancellationToken);
            if (!organization.Preferences.AllowTimeEntryEditing)
            {
                throw ApiException.Validation(existing.Mode == TimeEntryMode.Punch
                    ? "You cannot change punch times here."
                    : "Time entries cannot be edited.");
            }
        }

        if (existing.Mode == TimeEntryMode.Punch)
        {
            if (request.Times.Any)
            {
                var user = await db.UsersWithProfile().FirstOrDefaultAsync(item => item.Id == existing.UserId, cancellationToken)
                    ?? throw ApiException.NotFound();
                var punch = EditedPunch(user, existing, request.Times);
                if (punch.EndedAt is null && existing.EndedAt is not null
                    && await db.UserTimeEntries.AnyAsync(
                        entry => entry.UserId == existing.UserId
                            && entry.Mode == TimeEntryMode.Punch
                            && entry.EndedAt == null
                            && entry.Id != existing.Id,
                        cancellationToken))
                {
                    throw ApiException.Conflict("You already have an open punch.");
                }

                existing.StartedAt = punch.StartedAt;
                existing.EndedAt = punch.EndedAt;
                existing.DurationMinutes = punch.DurationMinutes;
                existing.OccurredOn = punch.OccurredOn;
                existing.InKindValue = punch.DurationMinutes is int minutes
                    ? Fields.InKindFromMinutes(minutes, existing.HourlyRate)
                    : null;
            }
        }
        else
        {
            var times = existing.Mode == TimeEntryMode.Duration
                ? EntryTimes.Duration(request.Times, existing)
                : EntryTimes.Total(request.Times, existing);
            existing.StartedAt = times.StartedAt;
            existing.EndedAt = times.EndedAt;
            existing.DurationMinutes = times.DurationMinutes;
            existing.OccurredOn = times.OccurredOn;
            existing.InKindValue = Fields.InKindFromMinutes(times.DurationMinutes, existing.HourlyRate);
        }

        if (tags is not null)
        {
            existing.Tags.Clear();
            foreach (var tag in tags)
            {
                existing.Tags.Add(tag);
            }
        }

        await db.SaveOrThrowAsync(cancellationToken);
        return TimeEntryDto.From(existing);
    }

    public async Task Delete(Guid entryId, CancellationToken cancellationToken)
    {
        db.UserTimeEntries.Remove(await Owned(entryId, true, cancellationToken));
        await db.SaveOrThrowAsync(cancellationToken);
    }

    public async Task<TimeEntryDto> ClockIn(ClockInRequest request, CancellationToken cancellationToken)
    {
        var userId = request.UserId
            ?? (access.IsApiKey ? throw ApiException.Validation("userId is required.") : access.ActorUserId);
        var user = await db.UsersWithProfile().FirstOrDefaultAsync(item => item.Id == userId, cancellationToken)
            ?? throw ApiException.NotFound();
        var placement = request.Placement;
        await rules.AssertCanWriteUserEntry(userId, placement.OrganizationId, placement.DepartmentId, cancellationToken);
        await rules.AssertLogTarget(userId, placement.OrganizationId, placement.DepartmentId, cancellationToken);
        await rules.AssertProject(userId, placement.OrganizationId, placement.DepartmentId, placement.ProjectId, cancellationToken);
        await rules.AssertTaskCategory(placement.OrganizationId, placement.TaskCategoryId, cancellationToken);
        var tags = await rules.Tags(placement.OrganizationId, placement.TagIds, cancellationToken);
        var (hourlyRateId, hourlyRate) = await rules.ResolveHourlyRate(userId, placement.OrganizationId, request.HourlyRateId, cancellationToken);
        var startedAt = time.UtcNowToSecond();
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockUserAsync(userId, cancellationToken);
        if (await HasOpenPunch(userId, cancellationToken))
        {
            throw ApiException.Conflict("You already have an open punch.");
        }

        var entry = NewEntry(userId, placement, TimeEntryMode.Punch, hourlyRateId, hourlyRate, tags);
        entry.StartedAt = startedAt;
        entry.OccurredOn = Fields.LocalDate(startedAt, TimeZoneOf(user));
        db.UserTimeEntries.Add(entry);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return TimeEntryDto.From(entry);
    }

    public async Task<TimeEntryDto> ClockOut(ClockOutRequest request, CancellationToken cancellationToken)
    {
        var userId = request.UserId
            ?? (access.IsApiKey ? throw ApiException.Validation("userId is required.") : access.ActorUserId);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.LockUserAsync(userId, cancellationToken);
        var open = await db.UserTimeEntries.Include(entry => entry.Tags)
            .FirstOrDefaultAsync(entry => entry.UserId == userId && entry.Mode == TimeEntryMode.Punch && entry.EndedAt == null, cancellationToken);
        if (open?.StartedAt is not DateTime startedAt)
        {
            throw ApiException.Conflict("No open punch.");
        }

        await rules.AssertCanWriteUserEntry(userId, open.OrganizationId, open.DepartmentId, cancellationToken);

        var endedAt = time.UtcNowToSecond();
        if (endedAt <= startedAt)
        {
            endedAt = startedAt.AddSeconds(1);
        }

        var durationMinutes = Fields.WholeMinutes(startedAt, endedAt);
        if (durationMinutes < 1)
        {
            endedAt = startedAt.AddMinutes(1);
            durationMinutes = 1;
        }

        Fields.AssertDurationMinutes(durationMinutes);
        open.EndedAt = endedAt;
        open.DurationMinutes = durationMinutes;
        open.InKindValue = Fields.InKindFromMinutes(durationMinutes, open.HourlyRate);
        open.Description = request.Description.Or(open.Description);
        if (request.TagIds.HasValue)
        {
            var tags = await rules.Tags(open.OrganizationId, request.TagIds.Value, cancellationToken);
            open.Tags.Clear();
            foreach (var tag in tags)
            {
                open.Tags.Add(tag);
            }
        }

        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return TimeEntryDto.From(open);
    }

    private UserTimeEntry NewEntry(Guid userId, EntryPlacement placement, TimeEntryMode mode, Guid hourlyRateId, decimal hourlyRate, List<Tag> tags) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        EnteredByUserId = access.ActorUserId,
        OrganizationId = placement.OrganizationId,
        DepartmentId = placement.DepartmentId,
        ProjectId = placement.ProjectId,
        TaskCategoryId = placement.TaskCategoryId,
        HourlyRateId = hourlyRateId,
        Mode = mode,
        Description = placement.Description,
        HourlyRate = hourlyRate,
        SourceRef = placement.SourceRef,
        CreatedAt = time.UtcNow(),
        Tags = tags,
    };

    private Task<bool> HasOpenPunch(Guid userId, CancellationToken cancellationToken) =>
        db.UserTimeEntries.AnyAsync(
            entry => entry.UserId == userId && entry.Mode == TimeEntryMode.Punch && entry.EndedAt == null,
            cancellationToken);

    private async Task<UserTimeEntry> Owned(Guid entryId, bool write, CancellationToken cancellationToken)
    {
        var entry = await db.UserTimeEntries.Include(item => item.Tags).FirstOrDefaultAsync(item => item.Id == entryId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (access.IsApiKey)
        {
            await access.RequireOrganization(entry.OrganizationId, write, cancellationToken);
            return entry;
        }

        if (entry.UserId == access.ActorUserId
            || entry.EnteredByUserId == access.ActorUserId
            || access.IsSuperAdmin
            || await access.IsOrgAdmin(entry.OrganizationId, cancellationToken)
            || (entry.DepartmentId is Guid departmentId && await access.IsDepartmentAdmin(departmentId, cancellationToken))
            || await connections.VolunteerConnectedTo(entry.OrganizationId, entry.UserId, cancellationToken))
        {
            return entry;
        }

        throw ApiException.Forbidden();
    }

    private static (DateTime StartedAt, DateTime? EndedAt, int? DurationMinutes, DateOnly OccurredOn) EditedPunch(
        User user,
        UserTimeEntry existing,
        TimeFields fields)
    {
        var startedAt = fields.StartedAt.HasValue ? fields.StartedAt.Value : existing.StartedAt;
        if (startedAt is not DateTime started)
        {
            throw ApiException.Validation("startedAt is required.");
        }

        var endedAt = fields.EndedAt.HasValue ? fields.EndedAt.Value : existing.EndedAt;
        var durationProvided = fields.DurationMinutes.HasValue;
        int? durationMinutes = durationProvided ? fields.DurationMinutes.Value : existing.DurationMinutes;
        var occurredOn = Fields.LocalDate(started, TimeZoneOf(user));
        if (fields.OccurredOn.HasValue && fields.OccurredOn.Value != occurredOn)
        {
            throw ApiException.Validation("occurredOn must be the local date of startedAt.");
        }

        if (endedAt is null && !durationProvided)
        {
            return (started, null, null, occurredOn);
        }

        if (endedAt is DateTime ended && !durationProvided)
        {
            if (ended <= started)
            {
                throw ApiException.Validation("endedAt must be after startedAt.");
            }

            durationMinutes = Fields.WholeMinutes(started, ended);
        }
        else if (durationProvided && !fields.EndedAt.HasValue)
        {
            if (durationMinutes is not int supplied)
            {
                throw ApiException.Validation("durationMinutes must be greater than zero.");
            }

            endedAt = started.AddMinutes(supplied);
        }
        else if (endedAt is DateTime bothEnded && durationMinutes is int bothMinutes)
        {
            if (bothEnded <= started)
            {
                throw ApiException.Validation("endedAt must be after startedAt.");
            }

            if (Fields.WholeMinutes(started, bothEnded) != bothMinutes)
            {
                throw ApiException.Validation("durationMinutes does not match startedAt and endedAt.");
            }
        }
        else
        {
            throw ApiException.Validation("endedAt or durationMinutes is required.");
        }

        if (durationMinutes is not int minutes || minutes < 1)
        {
            throw ApiException.Validation("durationMinutes must be from 1 to 1440.");
        }

        Fields.AssertDurationMinutes(minutes);
        return (started, endedAt, minutes, occurredOn);
    }

    private static (DateTime StartedAt, DateTime? EndedAt, int? DurationMinutes, DateOnly OccurredOn) PunchTimes(
        User user,
        DateTime startedAt,
        PunchFields punch)
    {
        var occurredOn = Fields.LocalDate(startedAt, TimeZoneOf(user));
        if (punch.OccurredOn is DateOnly sent && sent != occurredOn)
        {
            throw ApiException.Validation("occurredOn must be the local date of startedAt.");
        }

        var suppliedDuration = punch.DurationMinutes.Or(null);
        if (punch.EndedAt is not DateTime endedAt)
        {
            if (suppliedDuration is not null)
            {
                throw ApiException.Validation("durationMinutes must be empty while a punch is open.");
            }

            return (startedAt, null, null, occurredOn);
        }

        if (endedAt <= startedAt)
        {
            throw ApiException.Validation("endedAt must be after startedAt.");
        }

        var durationMinutes = Fields.WholeMinutes(startedAt, endedAt);
        if (durationMinutes < 1)
        {
            throw ApiException.Validation("durationMinutes must be from 1 to 1440.");
        }

        Fields.AssertDurationMinutes(durationMinutes);
        if (suppliedDuration is not null && suppliedDuration != durationMinutes)
        {
            throw ApiException.Validation("durationMinutes does not match startedAt and endedAt.");
        }

        return (startedAt, endedAt, durationMinutes, occurredOn);
    }

    private static string TimeZoneOf(User user) =>
        string.IsNullOrWhiteSpace(user.Profile?.Timezone) ? "UTC" : user.Profile!.Timezone;
}
