using System.Text.Json;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Reports;

public sealed record SavedReportDto(
    Guid Id,
    Guid OrganizationId,
    string Name,
    bool IsDefault,
    bool IsDashboard,
    JsonElement Layout,
    JsonElement Filters,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static SavedReportDto From(Report report) => new(
        report.Id,
        report.OrganizationId,
        report.Name,
        report.IsDefault,
        report.IsDashboard,
        ReportDocuments.Element(report.Layout),
        ReportDocuments.StoredFilters(report.Filters),
        report.CreatedAt,
        report.UpdatedAt);
}

public readonly record struct SaveReportBody(string? Name, bool? IsDefault, bool? IsDashboard, JsonElement Layout, JsonElement Filters)
{
    public static SaveReportBody Read(JsonElement body)
    {
        if (body.ValueKind != JsonValueKind.Object)
        {
            throw ApiException.Validation("Request body must be JSON.");
        }

        string? name = null;
        if (body.TryGetProperty("name", out var nameValue) && nameValue.ValueKind != JsonValueKind.Null)
        {
            name = nameValue.ValueKind == JsonValueKind.String
                ? nameValue.GetString()
                : throw ApiException.Validation("name must be a string.");
        }

        bool? isDefault = null;
        if (body.TryGetProperty("isDefault", out var defaultValue) && defaultValue.ValueKind != JsonValueKind.Null)
        {
            isDefault = defaultValue.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => throw ApiException.Validation("isDefault must be a boolean."),
            };
        }

        bool? isDashboard = null;
        if (body.TryGetProperty("isDashboard", out var dashboardValue) && dashboardValue.ValueKind != JsonValueKind.Null)
        {
            isDashboard = dashboardValue.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                _ => throw ApiException.Validation("isDashboard must be a boolean."),
            };
        }

        var layout = body.TryGetProperty("layout", out var layoutValue) ? layoutValue : default;
        var filters = body.TryGetProperty("filters", out var filtersValue) ? filtersValue : default;
        return new SaveReportBody(name, isDefault, isDashboard, layout, filters);
    }

    public static async ValueTask<SaveReportBody> BindAsync(HttpContext context) =>
        Read(JsonSerializer.SerializeToElement(await Body.Read(context)));
}

public sealed record ReportDataQuery(string? From, string? To, string? ClearDates);

public sealed class SavedReportsService(ClockedInDbContext db, Access access, ReportsService reports, TimeProvider time)
{
    public async Task<ListResponse<SavedReportDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var items = await db.Reports.AsNoTracking()
            .Where(report => report.OrganizationId == organizationId)
            .OrderBy(report => report.Name)
            .ThenBy(report => report.CreatedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(items.Select(SavedReportDto.From).ToList(), page);
    }

    public async Task<SavedReportDto> Get(Guid organizationId, Guid reportId, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        return SavedReportDto.From(await Find(organizationId, reportId, cancellationToken));
    }

    public async Task<SavedReportDto> Create(Guid organizationId, SaveReportBody body, CancellationToken cancellationToken)
    {
        await access.RequireReportDesigner(organizationId, cancellationToken);
        if (body.Layout.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            throw ApiException.Validation("layout is required.");
        }

        var name = ReportDocuments.Name(body.Name);
        var layout = ReportDocuments.Layout(body.Layout);
        var filters = ReportDocuments.Filters(body.Filters);
        var isDefault = body.IsDefault ?? false;
        var isDashboard = body.IsDashboard ?? false;
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        if (isDefault)
        {
            await ClearDefault(organizationId, null, cancellationToken);
        }

        if (isDashboard)
        {
            await ClearDashboard(organizationId, null, cancellationToken);
        }

        await EnsureNameAvailable(organizationId, name, null, cancellationToken);
        var now = time.GetUtcNow().UtcDateTime;
        var report = new Report
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            Name = name,
            IsDefault = isDefault,
            IsDashboard = isDashboard,
            Layout = layout,
            Filters = filters,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Reports.Add(report);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return SavedReportDto.From(report);
    }

    public async Task<SavedReportDto> Update(Guid organizationId, Guid reportId, SaveReportBody body, CancellationToken cancellationToken)
    {
        await access.RequireReportDesigner(organizationId, cancellationToken);
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var report = await db.Reports.FirstOrDefaultAsync(
            item => item.Id == reportId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();
        if (body.Name is not null)
        {
            report.Name = ReportDocuments.Name(body.Name);
            await EnsureNameAvailable(organizationId, report.Name, report.Id, cancellationToken);
        }

        if (body.Layout.ValueKind is not JsonValueKind.Undefined)
        {
            if (body.Layout.ValueKind is JsonValueKind.Null)
            {
                throw ApiException.Validation("layout is required.");
            }

            report.Layout = ReportDocuments.Layout(body.Layout);
        }

        if (body.Filters.ValueKind is not JsonValueKind.Undefined)
        {
            report.Filters = ReportDocuments.Filters(body.Filters);
        }

        if (body.IsDefault is true)
        {
            await ClearDefault(organizationId, report.Id, cancellationToken);
            report.IsDefault = true;
        }
        else if (body.IsDefault is false)
        {
            report.IsDefault = false;
        }

        if (body.IsDashboard is true)
        {
            await ClearDashboard(organizationId, report.Id, cancellationToken);
            report.IsDashboard = true;
        }
        else if (body.IsDashboard is false)
        {
            report.IsDashboard = false;
        }

        report.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return SavedReportDto.From(report);
    }

    public async Task Delete(Guid organizationId, Guid reportId, CancellationToken cancellationToken)
    {
        await access.RequireReportDesigner(organizationId, cancellationToken);
        var report = await db.Reports.FirstOrDefaultAsync(
            item => item.Id == reportId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();
        db.Reports.Remove(report);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    public async Task<ReportDto> Data(Guid organizationId, Guid reportId, ReportDataQuery query, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var report = await Find(organizationId, reportId, cancellationToken);
        var clearDates = false;
        if (!string.IsNullOrEmpty(query.ClearDates))
        {
            if (query.ClearDates != "true")
            {
                throw ApiException.Validation("clearDates must be true.");
            }

            clearDates = true;
        }

        var stored = ReportDocuments.ReadFilters(report.Filters);
        var filter = new ReportFilter(
            stored.DepartmentId,
            stored.TaskCategoryId,
            stored.ProjectId,
            stored.UserId,
            clearDates ? query.From : query.From ?? stored.From,
            clearDates ? query.To : query.To ?? stored.To);
        return await reports.Report(organizationId, filter, cancellationToken);
    }

    private async Task<Report> Find(Guid organizationId, Guid reportId, CancellationToken cancellationToken) =>
        await db.Reports.AsNoTracking().FirstOrDefaultAsync(
            item => item.Id == reportId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();

    private async Task ClearDefault(Guid organizationId, Guid? exceptId, CancellationToken cancellationToken)
    {
        await db.LockOrganizationAsync(organizationId, cancellationToken);
        var defaults = db.Reports.Where(item => item.OrganizationId == organizationId && item.IsDefault);
        if (exceptId is Guid keepId)
        {
            defaults = defaults.Where(item => item.Id != keepId);
        }

        foreach (var item in await defaults.ToListAsync(cancellationToken))
        {
            item.IsDefault = false;
            item.UpdatedAt = time.GetUtcNow().UtcDateTime;
        }
    }

    private async Task ClearDashboard(Guid organizationId, Guid? exceptId, CancellationToken cancellationToken)
    {
        await db.LockOrganizationAsync(organizationId, cancellationToken);
        var dashboards = db.Reports.Where(item => item.OrganizationId == organizationId && item.IsDashboard);
        if (exceptId is Guid keepId)
        {
            dashboards = dashboards.Where(item => item.Id != keepId);
        }

        foreach (var item in await dashboards.ToListAsync(cancellationToken))
        {
            item.IsDashboard = false;
            item.UpdatedAt = time.GetUtcNow().UtcDateTime;
        }
    }

    private async Task EnsureNameAvailable(Guid organizationId, string name, Guid? exceptId, CancellationToken cancellationToken)
    {
        var taken = db.Reports.Where(item => item.OrganizationId == organizationId && item.Name == name);
        if (exceptId is Guid keepId)
        {
            taken = taken.Where(item => item.Id != keepId);
        }

        if (await taken.AnyAsync(cancellationToken))
        {
            throw ApiException.Conflict("A report with that name already exists.");
        }
    }
}

public static class SavedReportsEndpoints
{
    public static void MapSavedReportEndpoints(this IEndpointRouteBuilder app)
    {
        var reports = app.MapGroup("/organizations/{id:guid}/reports").RequireAuthorization();
        reports.MapGet("", async Task<Ok<ListResponse<SavedReportDto>>> (Guid id, [AsParameters] PageQuery query, SavedReportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        reports.MapPost("", async Task<Created<SavedReportDto>> (Guid id, SaveReportBody body, SavedReportsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, body, ct)));
        reports.MapGet("/{reportId:guid}", async Task<Ok<SavedReportDto>> (Guid id, Guid reportId, SavedReportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, reportId, ct)));
        reports.MapGet("/{reportId:guid}/data", async Task<Ok<ReportDto>> (Guid id, Guid reportId, [AsParameters] ReportDataQuery query, SavedReportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Data(id, reportId, query, ct)));
        reports.MapPatch("/{reportId:guid}", async Task<Ok<SavedReportDto>> (Guid id, Guid reportId, SaveReportBody body, SavedReportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, reportId, body, ct)));
        reports.MapDelete("/{reportId:guid}", async Task<NoContent> (Guid id, Guid reportId, SavedReportsService service, CancellationToken ct) =>
        {
            await service.Delete(id, reportId, ct);
            return TypedResults.NoContent();
        });
    }
}
