using System.Text.Json.Nodes;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.TimeEntries;

public sealed record TimeEntryDto(
    Guid Id,
    Guid UserId,
    Guid EnteredByUserId,
    Guid OrganizationId,
    Guid? DepartmentId,
    Guid ProjectId,
    Guid TaskCategoryId,
    Guid? HourlyRateId,
    string Mode,
    DateTime? StartedAt,
    DateTime? EndedAt,
    int? DurationMinutes,
    DateOnly OccurredOn,
    string? Description,
    decimal HourlyRate,
    decimal? InKindValue,
    DateTime CreatedAt,
    string? SourceRef,
    Guid[] TagIds)
{
    public static TimeEntryDto From(UserTimeEntry entry) => new(
        entry.Id,
        entry.UserId,
        entry.EnteredByUserId,
        entry.OrganizationId,
        entry.DepartmentId,
        entry.ProjectId,
        entry.TaskCategoryId,
        entry.HourlyRateId,
        entry.Mode.ToString(),
        entry.StartedAt,
        entry.EndedAt,
        entry.DurationMinutes,
        entry.OccurredOn,
        entry.Description,
        entry.HourlyRate,
        entry.InKindValue,
        entry.CreatedAt,
        entry.SourceRef,
        entry.Tags.Select(tag => tag.Id).Order().ToArray());
}

public readonly record struct TimeFields(
    Optional<int> DurationMinutes,
    Optional<DateOnly> OccurredOn,
    Optional<DateTime?> StartedAt,
    Optional<DateTime?> EndedAt)
{
    public bool Any => DurationMinutes.HasValue || OccurredOn.HasValue || StartedAt.HasValue || EndedAt.HasValue;

    public static TimeFields Parse(JsonObject body) => new(
        Optional.Read(body, "durationMinutes", Fields.RequiredInt),
        Optional.Read(body, "occurredOn", Fields.RequiredDate),
        Optional.Read(body, "startedAt", Fields.OptionalInstant),
        Optional.Read(body, "endedAt", Fields.OptionalInstant));
}

public sealed record EntryTimes(DateTime? StartedAt, DateTime? EndedAt, int DurationMinutes, DateOnly OccurredOn)
{
    public static EntryTimes Duration(TimeFields fields, UserTimeEntry? existing)
    {
        var occurredOn = fields.OccurredOn.HasValue ? fields.OccurredOn.Value : existing?.OccurredOn;
        if (occurredOn is not DateOnly date)
        {
            throw ApiException.Validation("occurredOn is required.");
        }

        var startedAt = fields.StartedAt.Or(existing?.StartedAt);
        var endedAt = fields.EndedAt.Or(existing?.EndedAt);
        var durationProvided = fields.DurationMinutes.HasValue;
        int? durationMinutes = durationProvided ? fields.DurationMinutes.Value : existing?.DurationMinutes;
        if (startedAt is null && endedAt is null)
        {
            if (durationMinutes is not int minutesOnly)
            {
                throw ApiException.Validation("durationMinutes must be greater than zero.");
            }

            Fields.AssertDurationMinutes(minutesOnly);
            return new EntryTimes(null, null, minutesOnly, date);
        }

        if (startedAt is not DateTime started)
        {
            throw ApiException.Validation("startedAt is required.");
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

        if (durationMinutes is not int minutes)
        {
            throw ApiException.Validation("durationMinutes must be greater than zero.");
        }

        Fields.AssertDurationMinutes(minutes);
        return new EntryTimes(started, endedAt, minutes, date);
    }

    public static EntryTimes Total(TimeFields fields, UserTimeEntry? existing)
    {
        var startedAt = fields.StartedAt.HasValue ? fields.StartedAt.Value : existing?.StartedAt;
        var endedAt = fields.EndedAt.HasValue ? fields.EndedAt.Value : existing?.EndedAt;
        var durationMinutes = fields.DurationMinutes.HasValue ? fields.DurationMinutes.Value : existing?.DurationMinutes;
        var occurredOn = fields.OccurredOn.HasValue ? fields.OccurredOn.Value : existing?.OccurredOn;
        if (durationMinutes is not int minutes)
        {
            throw ApiException.Validation("durationMinutes must be greater than zero.");
        }

        Fields.AssertTotalMinutes(minutes);
        if (occurredOn is not DateOnly date)
        {
            throw ApiException.Validation("occurredOn is required.");
        }

        return new EntryTimes(startedAt, endedAt, minutes, date);
    }
}

public sealed record PunchFields(DateTime? StartedAt, DateTime? EndedAt, Optional<int?> DurationMinutes, DateOnly? OccurredOn)
{
    public static PunchFields Parse(JsonObject body) => new(
        Fields.Has(body, "startedAt") ? Fields.RequiredInstant(body, "startedAt") : null,
        Fields.OptionalInstant(body, "endedAt"),
        Optional.Read(body, "durationMinutes", (b, k) => b[k] is null ? (int?)null : Fields.RequiredInt(b, k)),
        Fields.Has(body, "occurredOn") ? Fields.RequiredDate(body, "occurredOn") : null);
}

public sealed record EntryPlacement(
    Guid OrganizationId,
    Guid? DepartmentId,
    Guid ProjectId,
    Guid TaskCategoryId,
    string? Description,
    List<Guid> TagIds,
    string? SourceRef)
{
    public static EntryPlacement Parse(JsonObject body)
    {
        var organizationId = Fields.RequiredGuid(body, "organizationId");
        var departmentId = Fields.OptionalGuid(body, "departmentId");
        var projectId = Fields.RequiredGuid(body, "projectId");
        var taskCategoryId = Fields.RequiredGuid(body, "taskCategoryId");
        var description = Fields.OptionalDescription(body);
        var tagIds = Fields.Ids(body, "tagIds", optional: true);
        return new EntryPlacement(organizationId, departmentId, projectId, taskCategoryId, description, tagIds, Fields.SourceRef(body));
    }
}

public sealed record CreateTimeEntryRequest(TimeEntryMode Mode, EntryPlacement Placement, PunchFields? Punch, EntryTimes? Times, Guid? HourlyRateId)
{
    public static async ValueTask<CreateTimeEntryRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context), null);

    public static CreateTimeEntryRequest Parse(JsonObject body, TimeEntryMode? fixedMode)
    {
        var mode = fixedMode ?? Fields.RequiredString(body, "mode") switch
        {
            "Punch" => TimeEntryMode.Punch,
            "Duration" => TimeEntryMode.Duration,
            "Total" => TimeEntryMode.Total,
            _ => throw ApiException.Validation("mode must be Punch, Duration, or Total."),
        };
        var placement = EntryPlacement.Parse(body);
        var hourlyRateId = Fields.Has(body, "hourlyRateId") ? Fields.OptionalGuid(body, "hourlyRateId") : null;
        return mode switch
        {
            TimeEntryMode.Punch => new CreateTimeEntryRequest(mode, placement, PunchFields.Parse(body), null, hourlyRateId),
            TimeEntryMode.Duration => new CreateTimeEntryRequest(mode, placement, null, EntryTimes.Duration(TimeFields.Parse(body), null), hourlyRateId),
            _ => new CreateTimeEntryRequest(mode, placement, null, EntryTimes.Total(TimeFields.Parse(body), null), hourlyRateId),
        };
    }
}

public sealed record LogDurationRequest(CreateTimeEntryRequest Entry)
{
    public static async ValueTask<LogDurationRequest?> BindAsync(HttpContext context) =>
        new(CreateTimeEntryRequest.Parse(await Body.Read(context), TimeEntryMode.Duration));
}

public sealed record LogTotalRequest(CreateTimeEntryRequest Entry)
{
    public static async ValueTask<LogTotalRequest?> BindAsync(HttpContext context) =>
        new(CreateTimeEntryRequest.Parse(await Body.Read(context), TimeEntryMode.Total));
}

public sealed record ClockInRequest(EntryPlacement Placement, Guid? HourlyRateId, Guid? UserId)
{
    public static async ValueTask<ClockInRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        var hourlyRateId = Fields.Has(body, "hourlyRateId") ? Fields.OptionalGuid(body, "hourlyRateId") : null;
        var userId = Fields.Has(body, "userId") ? Fields.OptionalGuid(body, "userId") : null;
        return new ClockInRequest(EntryPlacement.Parse(body), hourlyRateId, userId);
    }
}

public sealed record ClockOutRequest(Optional<string?> Description, Optional<List<Guid>> TagIds, Guid? UserId)
{
    public static async ValueTask<ClockOutRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        return new ClockOutRequest(
            Optional.Read(body, "description", (b, k) => Fields.Description(Fields.OptionalString(b, k))),
            Optional.Read(body, "tagIds", (b, k) => Fields.Ids(b, k, optional: false)),
            Fields.Has(body, "userId") ? Fields.OptionalGuid(body, "userId") : null);
    }
}

public sealed record UpdateTimeEntryRequest(
    Optional<Guid> OrganizationId,
    Optional<Guid?> DepartmentId,
    Optional<Guid> ProjectId,
    Optional<Guid> TaskCategoryId,
    Optional<Guid?> HourlyRateId,
    Optional<string?> Description,
    Optional<List<Guid>> TagIds,
    TimeFields Times)
{
    public static async ValueTask<UpdateTimeEntryRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateTimeEntryRequest Parse(JsonObject body) => new(
        Optional.Read(body, "organizationId", Fields.RequiredGuid),
        Optional.Read(body, "departmentId", Fields.OptionalGuid),
        Optional.Read(body, "projectId", Fields.RequiredGuid),
        Optional.Read(body, "taskCategoryId", Fields.RequiredGuid),
        Optional.Read(body, "hourlyRateId", Fields.OptionalGuid),
        Optional.Read(body, "description", (b, k) => Fields.Description(Fields.OptionalString(b, k))),
        Optional.Read(body, "tagIds", (b, k) => Fields.Ids(b, k, optional: false)),
        TimeFields.Parse(body));
}
