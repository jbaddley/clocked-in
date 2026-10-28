using System.Globalization;
using System.Linq.Expressions;
using System.Text;
using System.Text.Json.Serialization;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Reports;

public sealed record BucketDto(
    string Id,
    string Label,
    decimal Hours,
    int Volunteers,
    int Entries,
    decimal InKind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ProjectType = null);

public sealed record UserRollupDto(
    decimal Hours,
    int Volunteers,
    int Entries,
    decimal InKind,
    BucketDto[] ByDepartment,
    BucketDto[] ByCategory,
    BucketDto[] ByPerson,
    BucketDto[] ByVolunteer,
    BucketDto[] ByProject,
    BucketDto[] ByMonth);

public sealed record CollectiveRollupDto(
    decimal Hours,
    int Entries,
    decimal InKind,
    BucketDto[] ByDepartment,
    BucketDto[] ByCategory,
    BucketDto[] ByProject);

public sealed record ReportDto(UserRollupDto User, UserRollupDto Staff, CollectiveRollupDto Collective);

public sealed record PersonName(string Username, string? DisplayName, string? FirstName, string? LastName)
{
    public string Label
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(DisplayName))
            {
                return DisplayName.Trim();
            }

            var name = $"{FirstName} {LastName}".Trim();
            if (name.Length > 0)
            {
                return name;
            }

            return FirstName == "" && LastName == "" ? "" : Username;
        }
    }
}

public sealed class ReportsService(ClockedInDbContext db, Access access)
{
    /// <summary>Task category whose hours count as participation, not volunteering. Matches reports.ts.</summary>
    public const string ParticipantHoursCategory = "participant hours";

    public async Task<ReportDto> Report(Guid organizationId, ReportFilter query, CancellationToken cancellationToken)
    {
        var parsed = Filter.Parse(query);
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var filter = await ForCaller(organizationId, parsed, cancellationToken);
        var organization = await db.Organizations.AsNoTracking().FirstAsync(item => item.Id == organizationId, cancellationToken);
        var user = await UserRollup(organization, UserEntries(organizationId, filter, RateType.Volunteer), cancellationToken);
        var staff = await UserRollup(organization, UserEntries(organizationId, filter, RateType.Professional), cancellationToken);
        return new ReportDto(user, staff, await CollectiveRollup(organizationId, filter, cancellationToken));
    }

    private async Task<UserRollupDto> UserRollup(Organization organization, IQueryable<UserTimeEntry> entries, CancellationToken cancellationToken)
    {
        var byPerson = await Buckets(
            entries,
            entry => new { entry.UserId, entry.User.Username, entry.User.Profile!.DisplayName, entry.User.Profile.FirstName, entry.User.Profile.LastName },
            key => (key.UserId.ToString(), new PersonName(key.Username, key.DisplayName, key.FirstName, key.LastName).Label, (string?)null),
            cancellationToken);
        var named = byPerson.Where(row => row.Label.Length > 0).ToList();
        var volunteerMinutes = await entries
            .Where(entry => entry.TaskCategory.Name.ToLower() != ParticipantHoursCategory)
            .GroupBy(entry => entry.UserId)
            .Select(group => new { group.Key, Minutes = group.Sum(entry => entry.DurationMinutes ?? 0) })
            .ToListAsync(cancellationToken);
        var volunteerLookup = volunteerMinutes.ToDictionary(row => row.Key.ToString(), row => row.Minutes);
        var byVolunteer = named
            .Select(row => row with { Minutes = volunteerLookup.GetValueOrDefault(row.Id) })
            .ToList();
        var byMonthRows = await entries
            .GroupBy(entry => new { entry.OccurredOn.Year, entry.OccurredOn.Month })
            .Select(group => new
            {
                group.Key.Year,
                group.Key.Month,
                Minutes = group.Sum(entry => entry.DurationMinutes ?? 0),
                Entries = group.Count(),
                InKind = group.Sum(entry => entry.InKindValue ?? 0),
            })
            .ToListAsync(cancellationToken);
        var byMonth = byMonthRows
            .OrderBy(row => row.Year)
            .ThenBy(row => row.Month)
            .Select(row => new BucketDto(
                $"{row.Year}-{row.Month:00}",
                new DateTime(row.Year, row.Month, 1, 0, 0, 0, DateTimeKind.Utc).ToString("MMMM", CultureInfo.InvariantCulture),
                HoursFromMinutes(row.Minutes),
                0,
                row.Entries,
                Fields.RoundMoney(row.InKind)))
            .ToArray();
        var user = new UserRollupDto(
            HoursFromMinutes(byPerson.Sum(row => row.Minutes)),
            named.Count,
            byPerson.Sum(row => row.Entries),
            Fields.RoundMoney(byPerson.Sum(row => row.InKind)),
            Sorted(await Buckets(
                entries,
                entry => new { entry.DepartmentId, Name = entry.Department != null ? entry.Department.Name : null },
                key => (key.DepartmentId?.ToString() ?? "organization", key.Name ?? organization.Name, (string?)null),
                cancellationToken)),
            Sorted(await Buckets(
                entries,
                entry => new { entry.TaskCategoryId, entry.TaskCategory.Name },
                key => (key.TaskCategoryId.ToString(), key.Name, (string?)null),
                cancellationToken)),
            Sorted(named),
            Sorted(byVolunteer),
            Sorted(await Buckets(
                entries,
                entry => new { entry.ProjectId, entry.Project.Title, entry.Project.ProjectType },
                key => (key.ProjectId.ToString(), key.Title, key.ProjectType.ToString()),
                cancellationToken)),
            byMonth);
        return user;
    }

    public async Task<PushStreamHttpResult> Csv(Guid organizationId, ReportFilter query, CancellationToken cancellationToken)
    {
        var parsed = Filter.Parse(query);
        var organization = await access.RequireOrganization(organizationId, false, cancellationToken);
        var filter = await ForCaller(organizationId, parsed, cancellationToken);
        var copy = EntityCopy.From(organization.Preferences);
        var header = string.Join(',', new[]
        {
            "Date", copy.Project, "Volunteer", $"{copy.Department} / {copy.Organization}", copy.TaskCategory,
            "Entry Method", "Start Time", "End Time", "Manual Duration", "Hours", "Rate Type", "Hourly Rate",
            "In-Kind Value", "Tags", "Entered By", "Date Entered", "Hour Attribution", "Notes", "Volunteer ID",
        }.Select(CsvCell));
        var rows = UserEntries(organizationId, filter)
            .OrderBy(entry => entry.OccurredOn)
            .ThenBy(entry => entry.CreatedAt)
            .Select(entry => new
            {
                entry.OccurredOn,
                entry.Project.Title,
                Volunteer = new PersonName(entry.User.Username, entry.User.Profile!.DisplayName, entry.User.Profile.FirstName, entry.User.Profile.LastName),
                MemberNumber = entry.User.Profile!.MemberNumber,
                Group = entry.Department != null ? entry.Department.Name : entry.Organization.Name,
                Category = entry.TaskCategory.Name,
                entry.Mode,
                entry.StartedAt,
                entry.EndedAt,
                entry.DurationMinutes,
                entry.HourlyRate,
                RateName = entry.Rate != null ? entry.Rate.Name : "",
                entry.InKindValue,
                Tags = entry.Tags.Select(tag => tag.Name).ToList(),
                EnteredBy = new PersonName(entry.EnteredBy.Username, entry.EnteredBy.Profile!.DisplayName, entry.EnteredBy.Profile.FirstName, entry.EnteredBy.Profile.LastName),
                entry.CreatedAt,
                entry.Description,
            })
            .AsAsyncEnumerable();
        return TypedResults.Stream(async stream =>
        {
            await using var writer = new StreamWriter(stream, new UTF8Encoding(false));
            await writer.WriteAsync(header);
            await foreach (var row in rows.WithCancellation(cancellationToken))
            {
                string[] cells =
                [
                    SheetDate(row.OccurredOn.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)),
                    row.Title,
                    row.Volunteer.Label,
                    row.Group,
                    row.Category,
                    EntryMethod(row.Mode, row.StartedAt, row.EndedAt),
                    SheetTime(row.StartedAt),
                    SheetTime(row.EndedAt),
                    SheetDuration(row.DurationMinutes),
                    row.DurationMinutes is int minutes ? Hours(HoursFromMinutes(minutes)) : "",
                    row.RateName,
                    row.HourlyRate == 0 ? "" : Money(row.HourlyRate),
                    row.InKindValue is decimal inKind ? Money(inKind) : "",
                    string.Join(", ", row.Tags.Order(StringComparer.Ordinal)),
                    row.EnteredBy.Label,
                    SheetDate(row.CreatedAt),
                    "",
                    row.Description ?? "",
                    row.MemberNumber ?? "",
                ];
                await writer.WriteAsync('\n');
                await writer.WriteAsync(string.Join(',', cells.Select(CsvCell)));
            }
        }, "text/csv; charset=utf-8");
    }

    public async Task<PushStreamHttpResult> SummaryCsv(Guid organizationId, ReportFilter query, CancellationToken cancellationToken)
    {
        var report = await Report(organizationId, query, cancellationToken);
        var organization = await access.RequireOrganization(organizationId, false, cancellationToken);
        var copy = EntityCopy.From(organization.Preferences);
        return TypedResults.Stream(async stream =>
        {
            await using var writer = new StreamWriter(stream, new UTF8Encoding(false));
            async Task Line(params string[] cells)
            {
                await writer.WriteAsync(string.Join(',', cells.Select(CsvCell)));
                await writer.WriteAsync('\n');
            }

            await Line("Total Volunteer Hours", Hours(report.User.Hours));
            await Line("Total In-Kind Value", Money(report.User.InKind));
            await Line("Unique Volunteers", report.User.Volunteers.ToString(CultureInfo.InvariantCulture));
            await Line("Total Entries", report.User.Entries.ToString(CultureInfo.InvariantCulture));
            async Task Table(string title, IEnumerable<BucketDto> rows, string hoursHeader)
            {
                await Line();
                await Line(title, hoursHeader, "In-Kind Value");
                foreach (var row in rows)
                {
                    await Line(row.Label, Hours(row.Hours), Money(row.InKind));
                }
            }

            await Table(copy.Organization, report.User.ByDepartment, "Volunteer Hours");
            await Table(copy.TaskCategory, report.User.ByCategory, "Volunteer Hours");
            await Table("Month", report.User.ByMonth, "Volunteer Hours");
            await Table("Volunteer", report.User.ByVolunteer, "Total Hours");
            await Table(copy.Project, report.User.ByProject, "Volunteer Hours");
        }, "text/csv; charset=utf-8");
    }

    private IQueryable<UserTimeEntry> UserEntries(Guid organizationId, Filter filter, RateType? rateType = null) =>
        db.UserTimeEntries.AsNoTracking()
            .Where(entry => entry.OrganizationId == organizationId)
            .Where(entry => filter.DepartmentIds == null || (entry.DepartmentId != null && filter.DepartmentIds.Contains(entry.DepartmentId.Value)))
            .Where(entry =>
                rateType == null
                || (rateType == RateType.Volunteer && (entry.Rate == null || entry.Rate.Type == RateType.Volunteer))
                || (entry.Rate != null && entry.Rate.Type == rateType))
            .Where(entry => filter.TaskCategoryIds == null || (entry.TaskCategoryId != null && filter.TaskCategoryIds.Contains(entry.TaskCategoryId.Value)))
            .Where(entry => filter.ProjectIds == null || (entry.ProjectId != null && filter.ProjectIds.Contains(entry.ProjectId.Value)))
            .Where(entry => filter.UserIds == null || filter.UserIds.Contains(entry.UserId))
            .Where(entry => filter.From == null || entry.OccurredOn >= filter.From)
            .Where(entry => filter.To == null || entry.OccurredOn <= filter.To);

    private static async Task<List<BucketRow>> Buckets<TKey>(
        IQueryable<UserTimeEntry> entries,
        Expression<Func<UserTimeEntry, TKey>> key,
        Func<TKey, (string Id, string Label, string? ProjectType)> describe,
        CancellationToken cancellationToken)
    {
        var groups = await entries.GroupBy(key)
            .Select(group => new
            {
                group.Key,
                Minutes = group.Sum(entry => entry.DurationMinutes ?? 0),
                Volunteers = group.Select(entry => entry.UserId).Distinct().Count(),
                Entries = group.Count(),
                InKind = group.Sum(entry => entry.InKindValue ?? 0),
            })
            .ToListAsync(cancellationToken);
        return groups.Select(group =>
        {
            var (id, label, projectType) = describe(group.Key);
            return new BucketRow(id, label, group.Minutes, group.Volunteers, group.Entries, group.InKind, projectType);
        }).ToList();
    }

    private async Task<CollectiveRollupDto> CollectiveRollup(Guid organizationId, Filter filter, CancellationToken cancellationToken)
    {
        var from = filter.From?.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = filter.To?.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
        var entries = await db.CollectiveTimeEntries.AsNoTracking()
            .Where(entry => entry.OrganizationId == organizationId)
            .Where(entry => filter.DepartmentIds == null || (entry.DepartmentId != null && filter.DepartmentIds.Contains(entry.DepartmentId.Value)))
            .Where(entry => filter.TaskCategoryIds == null || filter.TaskCategoryIds.Contains(entry.TaskCategoryId))
            .Where(entry => filter.ProjectIds == null || filter.ProjectIds.Contains(entry.ProjectId))
            .Where(entry => entry.Rate == null || entry.Rate.Type == RateType.Volunteer)
            .Where(entry => from == null || entry.StartedAt >= from)
            .Where(entry => to == null || entry.StartedAt <= to)
            .Select(entry => new
            {
                entry.StartedAt,
                entry.EndedAt,
                entry.InKindValue,
                entry.DepartmentId,
                DepartmentName = entry.Department != null ? entry.Department.Name : null,
                entry.TaskCategoryId,
                CategoryName = entry.TaskCategory.Name,
                entry.ProjectId,
                entry.Project.Title,
                entry.Project.ProjectType,
            })
            .ToListAsync(cancellationToken);
        var rows = entries.Select(entry => new CollectiveRow(
                (int)Math.Round((entry.EndedAt - entry.StartedAt).TotalMinutes, MidpointRounding.AwayFromZero),
                entry.InKindValue,
                (entry.DepartmentId?.ToString() ?? "organization", entry.DepartmentName ?? "Organization", (string?)null),
                (entry.TaskCategoryId.ToString(), entry.CategoryName, (string?)null),
                (entry.ProjectId.ToString(), entry.Title, entry.ProjectType.ToString())))
            .ToList();

        BucketDto[] Group(Func<CollectiveRow, (string Id, string Label, string? ProjectType)> describe) =>
            Sorted(rows.GroupBy(row => describe(row).Id)
                .Select(group =>
                {
                    var described = describe(group.First());
                    return new BucketRow(
                        group.Key,
                        described.Label,
                        group.Sum(row => row.Minutes),
                        0,
                        group.Count(),
                        group.Sum(row => row.InKind),
                        described.ProjectType);
                })
                .ToList());

        return new CollectiveRollupDto(
            HoursFromMinutes(rows.Sum(row => row.Minutes)),
            rows.Count,
            Fields.RoundMoney(rows.Sum(row => row.InKind)),
            Group(row => row.Department),
            Group(row => row.Category),
            Group(row => row.Project));
    }

    private static BucketDto[] Sorted(List<BucketRow> rows) =>
        rows.Select(row => new BucketDto(
            row.Id,
            row.Label,
            HoursFromMinutes(row.Minutes),
            row.Volunteers,
            row.Entries,
            Fields.RoundMoney(row.InKind),
            row.ProjectType))
            .OrderByDescending(bucket => bucket.Hours)
            .ThenBy(bucket => bucket.Label, StringComparer.Ordinal)
            .ThenBy(bucket => bucket.Id, StringComparer.Ordinal)
            .ToArray();

    private static decimal HoursFromMinutes(int minutes) =>
        Math.Round(minutes / 60m, 5, MidpointRounding.AwayFromZero);

    private static string Hours(decimal hours) => hours.ToString("0.#####", CultureInfo.InvariantCulture);

    private static string Money(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);

    private static string SheetDate(DateTime value) =>
        $"{value.Month}/{value.Day}/{value.Year}";

    private static string SheetTime(DateTime? value)
    {
        if (value is not DateTime instant)
        {
            return "";
        }

        var hour = instant.Hour % 12;
        if (hour == 0)
        {
            hour = 12;
        }

        return $"{hour}:{instant.Minute:00} {(instant.Hour >= 12 ? "PM" : "AM")}";
    }

    private static string SheetDuration(int? minutes) =>
        minutes is int value ? $"{value / 60}:{value % 60:00}" : "";

    private sealed record EntityCopy(string Organization, string Project, string Department, string TaskCategory)
    {
        public static EntityCopy From(OrganizationPreferences? preferences) => new(
            Label(preferences?.EntityLabels.Organization, "Organization"),
            Label(preferences?.EntityLabels.Project, "Project"),
            Label(preferences?.EntityLabels.Department, "Department"),
            Label(preferences?.EntityLabels.TaskCategory, "Task category"));

        private static string Label(string? value, string fallback) =>
            string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static string EntryMethod(TimeEntryMode mode, DateTime? startedAt, DateTime? endedAt) =>
        mode == TimeEntryMode.Total ? "Total Hours"
        : (startedAt is not null && endedAt is not null) || mode == TimeEntryMode.Punch ? "Start / End Time"
        : "Duration";

    private static string CsvCell(string value)
    {
        if (value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r')
        {
            value = "'" + value;
        }

        return value.IndexOfAny(['"', ',', '\n', '\r']) >= 0
            ? $"\"{value.Replace("\"", "\"\"", StringComparison.Ordinal)}\""
            : value;
    }

    private sealed record CollectiveRow(
        int Minutes,
        decimal InKind,
        (string Id, string Label, string? ProjectType) Department,
        (string Id, string Label, string? ProjectType) Category,
        (string Id, string Label, string? ProjectType) Project);

    private sealed record BucketRow(
        string Id,
        string Label,
        int Minutes,
        int Volunteers,
        int Entries,
        decimal InKind,
        string? ProjectType = null);

    private async Task<Filter> ForCaller(Guid organizationId, Filter filter, CancellationToken cancellationToken)
    {
        var visibility = await access.Visibility(organizationId, cancellationToken);
        if (visibility.IsAll)
        {
            return filter;
        }

        if (visibility.IsDepartments)
        {
            if (filter.DepartmentIds is { } requested)
            {
                if (requested.Any(id => !visibility.DepartmentIds.Contains(id)))
                {
                    throw ApiException.Forbidden();
                }

                return filter;
            }

            return filter with { DepartmentIds = visibility.DepartmentIds.ToList() };
        }

        if (filter.UserIds is { } userIds && userIds.Any(id => id != access.ActorUserId))
        {
            throw ApiException.Forbidden();
        }

        return filter with { UserIds = [access.ActorUserId] };
    }

    private sealed record Filter(
        IReadOnlyList<Guid>? DepartmentIds,
        IReadOnlyList<Guid>? TaskCategoryIds,
        IReadOnlyList<Guid>? ProjectIds,
        IReadOnlyList<Guid>? UserIds,
        DateOnly? From,
        DateOnly? To)
    {
        public static Filter Parse(ReportFilter query) => new(
            Fields.QueryGuids(query.DepartmentId, "departmentId"),
            Fields.QueryGuids(query.TaskCategoryId, "taskCategoryId"),
            Fields.QueryGuids(query.ProjectId, "projectId"),
            Fields.QueryGuids(query.UserId, "userId"),
            Fields.QueryDate(query.From, "from"),
            Fields.QueryDate(query.To, "to"));
    }
}

public static class ReportsEndpoints
{
    public static void MapReportsEndpoints(this IEndpointRouteBuilder app)
    {
        var organization = app.MapGroup("/organizations/{id:guid}").RequireAuthorization();
        organization.MapGet("/report", async Task<Ok<ReportDto>> (Guid id, [AsParameters] ReportFilter filter, ReportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Report(id, filter, ct)));
        organization.MapGet("/time-entries.csv", (Guid id, [AsParameters] ReportFilter filter, ReportsService service, CancellationToken ct) =>
            service.Csv(id, filter, ct));
        organization.MapGet("/summary.csv", (Guid id, [AsParameters] ReportFilter filter, ReportsService service, CancellationToken ct) =>
            service.SummaryCsv(id, filter, ct));
    }
}
