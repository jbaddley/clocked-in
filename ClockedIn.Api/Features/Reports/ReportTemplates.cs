using System.Text.Json;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Reports;

public sealed record ReportTemplateDto(
    Guid Id,
    Guid? OrganizationId,
    string? Key,
    string Name,
    JsonElement Layout,
    Guid? BaseTemplateId,
    string Scope,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static ReportTemplateDto From(ReportTemplate template, string scope, string? key) => new(
        template.Id,
        template.OrganizationId,
        key,
        template.Name,
        ReportDocuments.Element(template.Layout),
        template.BaseTemplateId,
        scope,
        template.CreatedAt,
        template.UpdatedAt);
}

public readonly record struct SaveReportTemplateBody(string? Name, JsonElement Layout, Guid? BaseTemplateId)
{
    public static SaveReportTemplateBody Read(JsonElement body)
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

        Guid? baseTemplateId = null;
        if (body.TryGetProperty("baseTemplateId", out var baseValue) && baseValue.ValueKind != JsonValueKind.Null)
        {
            if (baseValue.ValueKind != JsonValueKind.String || !Guid.TryParse(baseValue.GetString(), out var parsed))
            {
                throw ApiException.Validation("baseTemplateId must be an id.");
            }

            baseTemplateId = parsed;
        }

        var layout = body.TryGetProperty("layout", out var layoutValue) ? layoutValue : default;
        return new SaveReportTemplateBody(name, layout, baseTemplateId);
    }
}

public sealed class ReportTemplatesService(ClockedInDbContext db, Access access, TimeProvider time)
{
    private static readonly string[] GlobalKeys = ["summary", "people", "groups", "staff"];

    public async Task<ListResponse<ReportTemplateDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var rows = await Visible(organizationId).AsNoTracking().ToListAsync(cancellationToken);
        var resolved = Resolve(rows);
        return ListResponse.Of(resolved.Skip(page.Offset).Take(page.Limit).ToList(), page);
    }

    public async Task<ReportTemplateDto> Get(Guid organizationId, Guid templateId, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var template = await FindVisible(organizationId, templateId, cancellationToken);
        return Describe(template, await Globals(cancellationToken));
    }

    public async Task<ReportTemplateDto> Create(Guid organizationId, SaveReportTemplateBody body, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        if (body.Layout.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null)
        {
            throw ApiException.Validation("layout is required.");
        }

        var layout = ReportDocuments.Layout(body.Layout);
        var now = time.GetUtcNow().UtcDateTime;
        if (body.BaseTemplateId is Guid baseId)
        {
            var global = await db.ReportTemplates.FirstOrDefaultAsync(
                item => item.Id == baseId && item.OrganizationId == null,
                cancellationToken) ?? throw ApiException.Validation("baseTemplateId must be a global template.");
            var name = body.Name is null ? global.Name : ReportDocuments.Name(body.Name);
            var existing = await db.ReportTemplates.FirstOrDefaultAsync(
                item => item.OrganizationId == organizationId && item.BaseTemplateId == baseId,
                cancellationToken);
            if (existing is not null)
            {
                await EnsureOrganizationName(organizationId, name, existing.Id, cancellationToken);
                existing.Name = name;
                existing.Layout = layout;
                existing.UpdatedAt = now;
                await db.SaveOrThrowAsync(cancellationToken);
                return ReportTemplateDto.From(existing, "override", global.Key);
            }

            await EnsureOrganizationName(organizationId, name, null, cancellationToken);
            var created = new ReportTemplate
            {
                Id = Guid.NewGuid(),
                OrganizationId = organizationId,
                Name = name,
                Layout = layout,
                BaseTemplateId = baseId,
                CreatedAt = now,
                UpdatedAt = now,
            };
            db.ReportTemplates.Add(created);
            await db.SaveOrThrowAsync(cancellationToken);
            return ReportTemplateDto.From(created, "override", global.Key);
        }

        var ownedName = ReportDocuments.Name(body.Name);
        await EnsureOrganizationName(organizationId, ownedName, null, cancellationToken);
        var template = new ReportTemplate
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            Name = ownedName,
            Layout = layout,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.ReportTemplates.Add(template);
        await db.SaveOrThrowAsync(cancellationToken);
        return ReportTemplateDto.From(template, "organization", null);
    }

    public async Task<ReportTemplateDto> Update(Guid organizationId, Guid templateId, SaveReportTemplateBody body, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var template = await db.ReportTemplates.FirstOrDefaultAsync(item => item.Id == templateId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (template.OrganizationId is null)
        {
            access.RequireSuperAdmin();
        }
        else if (template.OrganizationId != organizationId)
        {
            throw ApiException.NotFound();
        }
        else
        {
            await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        }

        if (body.BaseTemplateId is not null)
        {
            throw ApiException.Validation("baseTemplateId cannot be changed.");
        }

        if (body.Name is not null)
        {
            template.Name = ReportDocuments.Name(body.Name);
            if (template.OrganizationId is null)
            {
                await EnsureGlobalName(template.Name, template.Id, cancellationToken);
            }
            else
            {
                await EnsureOrganizationName(organizationId, template.Name, template.Id, cancellationToken);
            }
        }

        if (body.Layout.ValueKind is not JsonValueKind.Undefined)
        {
            if (body.Layout.ValueKind is JsonValueKind.Null)
            {
                throw ApiException.Validation("layout is required.");
            }

            template.Layout = ReportDocuments.Layout(body.Layout);
        }

        template.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveOrThrowAsync(cancellationToken);
        return Describe(template, await Globals(cancellationToken));
    }

    public async Task Delete(Guid organizationId, Guid templateId, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var template = await db.ReportTemplates.FirstOrDefaultAsync(item => item.Id == templateId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (template.OrganizationId is null)
        {
            throw ApiException.Forbidden();
        }

        if (template.OrganizationId != organizationId)
        {
            throw ApiException.NotFound();
        }

        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        db.ReportTemplates.Remove(template);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private IQueryable<ReportTemplate> Visible(Guid organizationId) =>
        db.ReportTemplates.Where(item => item.OrganizationId == null || item.OrganizationId == organizationId);

    private async Task<ReportTemplate> FindVisible(Guid organizationId, Guid templateId, CancellationToken cancellationToken) =>
        await Visible(organizationId).AsNoTracking().FirstOrDefaultAsync(item => item.Id == templateId, cancellationToken)
        ?? throw ApiException.NotFound();

    private async Task<Dictionary<Guid, ReportTemplate>> Globals(CancellationToken cancellationToken) =>
        await db.ReportTemplates.AsNoTracking()
            .Where(item => item.OrganizationId == null)
            .ToDictionaryAsync(item => item.Id, cancellationToken);

    private static List<ReportTemplateDto> Resolve(List<ReportTemplate> rows)
    {
        var overrides = rows
            .Where(item => item.BaseTemplateId is Guid)
            .ToDictionary(item => item.BaseTemplateId!.Value);
        var resolved = new List<ReportTemplateDto>();
        foreach (var key in GlobalKeys)
        {
            var global = rows.FirstOrDefault(item => item.OrganizationId == null && item.Key == key);
            if (global is null)
            {
                continue;
            }

            resolved.Add(overrides.TryGetValue(global.Id, out var replacement)
                ? ReportTemplateDto.From(replacement, "override", key)
                : ReportTemplateDto.From(global, "global", key));
        }

        foreach (var owned in rows
            .Where(item => item.OrganizationId is not null && item.BaseTemplateId is null)
            .OrderBy(item => item.Name)
            .ThenBy(item => item.CreatedAt))
        {
            resolved.Add(ReportTemplateDto.From(owned, "organization", null));
        }

        return resolved;
    }

    private static ReportTemplateDto Describe(ReportTemplate template, Dictionary<Guid, ReportTemplate> globals)
    {
        if (template.OrganizationId is null)
        {
            return ReportTemplateDto.From(template, "global", template.Key);
        }

        if (template.BaseTemplateId is Guid baseId && globals.TryGetValue(baseId, out var global))
        {
            return ReportTemplateDto.From(template, "override", global.Key);
        }

        return ReportTemplateDto.From(template, "organization", null);
    }

    private async Task EnsureGlobalName(string name, Guid exceptId, CancellationToken cancellationToken)
    {
        if (await db.ReportTemplates.AnyAsync(
            item => item.OrganizationId == null && item.Id != exceptId && item.Name == name,
            cancellationToken))
        {
            throw ApiException.Conflict("A template with that name already exists.");
        }
    }

    private async Task EnsureOrganizationName(Guid organizationId, string name, Guid? exceptId, CancellationToken cancellationToken)
    {
        var taken = db.ReportTemplates.Where(item => item.OrganizationId == organizationId && item.Name == name);
        if (exceptId is Guid keepId)
        {
            taken = taken.Where(item => item.Id != keepId);
        }

        if (await taken.AnyAsync(cancellationToken))
        {
            throw ApiException.Conflict("A template with that name already exists.");
        }
    }
}

public static class ReportTemplateEndpoints
{
    public static void MapReportTemplateEndpoints(this IEndpointRouteBuilder app)
    {
        var templates = app.MapGroup("/organizations/{id:guid}/report-templates").RequireAuthorization();
        templates.MapGet("", async Task<Ok<ListResponse<ReportTemplateDto>>> (Guid id, [AsParameters] PageQuery query, ReportTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        templates.MapPost("", async Task<Ok<ReportTemplateDto>> (Guid id, JsonElement body, ReportTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Create(id, SaveReportTemplateBody.Read(body), ct)));
        templates.MapGet("/{templateId:guid}", async Task<Ok<ReportTemplateDto>> (Guid id, Guid templateId, ReportTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, templateId, ct)));
        templates.MapPatch("/{templateId:guid}", async Task<Ok<ReportTemplateDto>> (Guid id, Guid templateId, JsonElement body, ReportTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, templateId, SaveReportTemplateBody.Read(body), ct)));
        templates.MapDelete("/{templateId:guid}", async Task<NoContent> (Guid id, Guid templateId, ReportTemplatesService service, CancellationToken ct) =>
        {
            await service.Delete(id, templateId, ct);
            return TypedResults.NoContent();
        });
    }
}
