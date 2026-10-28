using System.Text.Json.Nodes;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.EmailTemplates;

public sealed record EmailTemplateDto(
    Guid Id,
    Guid OrganizationId,
    string Name,
    int Version,
    string For,
    string Subject,
    string Heading,
    string Preview,
    string Template,
    bool IsEnabled,
    bool IsOptional,
    IReadOnlyList<string> Fields,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static EmailTemplateDto From(EmailTemplate row) => new(
        row.Id,
        row.OrganizationId,
        row.Name,
        row.Version,
        row.For.ToString(),
        row.Subject,
        row.Heading,
        row.Preview,
        row.Template,
        row.IsEnabled,
        EmailRenderer.Optional.Contains(row.For),
        EmailRenderer.Fields[row.For],
        row.CreatedAt,
        row.UpdatedAt);
}

public sealed class EmailTemplatesService(ClockedInDbContext db, Access access, TimeProvider time)
{
    public async Task<ListResponse<EmailTemplateDto>> List(Guid organizationId, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        await EnsureSeeded(organizationId, cancellationToken);
        var rows = await db.EmailTemplates.AsNoTracking()
            .Where(item => item.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);
        var items = rows.OrderBy(item => (int)item.For).Select(EmailTemplateDto.From).ToList();
        return new ListResponse<EmailTemplateDto>(items, 100, 0);
    }

    public async Task<EmailTemplateDto> Get(Guid organizationId, Guid templateId, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        return EmailTemplateDto.From(await Find(organizationId, templateId, cancellationToken));
    }

    public async Task<EmailTemplateDto> Update(Guid organizationId, Guid templateId, JsonObject body, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var row = await Find(organizationId, templateId, cancellationToken);
        if (Fields.Has(body, "for"))
        {
            throw ApiException.Validation("for cannot be changed.");
        }

        string[] keys = ["name", "subject", "heading", "preview", "template", "isEnabled"];
        if (!keys.Any(key => Fields.Has(body, key)))
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        if (Fields.Has(body, "name"))
        {
            row.Name = Text(body, "name", 80, true);
        }

        if (Fields.Has(body, "subject"))
        {
            row.Subject = Text(body, "subject", 200, true);
        }

        if (Fields.Has(body, "heading"))
        {
            row.Heading = Text(body, "heading", 120, true);
        }

        if (Fields.Has(body, "preview"))
        {
            row.Preview = Text(body, "preview", 200, false);
        }

        if (Fields.Has(body, "template"))
        {
            var html = EmailRenderer.Sanitize(Text(body, "template", 20000, true));
            if (EmailRenderer.HtmlToText(html).Length == 0)
            {
                throw ApiException.Validation("template is required.");
            }

            row.Template = html;
        }

        if (Fields.Has(body, "isEnabled"))
        {
            var enabled = Fields.RequiredBool(body, "isEnabled");
            if (!enabled && !EmailRenderer.Optional.Contains(row.For))
            {
                throw ApiException.Validation("This email cannot be turned off.");
            }

            row.IsEnabled = enabled;
        }

        var unknown = EmailRenderer.UnknownPlaceholders(row.For, row.Subject, row.Heading, row.Preview, row.Template);
        if (unknown.Count > 0)
        {
            throw ApiException.Validation($"{{{{{unknown[0]}}}}} is not a field for this email.");
        }

        row.Version += 1;
        row.UpdatedAt = time.UtcNow();
        await db.SaveOrThrowAsync(cancellationToken);
        return EmailTemplateDto.From(row);
    }

    public async Task<EmailTemplateDto> Reset(Guid organizationId, Guid templateId, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var row = await Find(organizationId, templateId, cancellationToken);
        var defaults = EmailTemplateDefaults.For(row.For);
        row.Name = defaults.Name;
        row.Subject = defaults.Subject;
        row.Heading = defaults.Heading;
        row.Preview = defaults.Preview;
        row.Template = defaults.Html;
        row.IsEnabled = true;
        row.Version += 1;
        row.UpdatedAt = time.UtcNow();
        await db.SaveOrThrowAsync(cancellationToken);
        return EmailTemplateDto.From(row);
    }

    /// <summary>Adds any default template the organization is missing.</summary>
    public async Task EnsureSeeded(Guid organizationId, CancellationToken cancellationToken)
    {
        var existing = await db.EmailTemplates.AsNoTracking()
            .Where(item => item.OrganizationId == organizationId)
            .Select(item => item.For)
            .ToListAsync(cancellationToken);
        var now = time.UtcNow();
        var missing = EmailTemplateDefaults.All.Where(item => !existing.Contains(item.For)).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        foreach (var item in missing)
        {
            db.EmailTemplates.Add(EmailTemplateDefaults.NewRow(organizationId, item, now));
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
        }
    }

    private async Task<EmailTemplate> Find(Guid organizationId, Guid templateId, CancellationToken cancellationToken) =>
        await db.EmailTemplates.FirstOrDefaultAsync(
            item => item.Id == templateId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();

    private static string Text(JsonObject body, string key, int max, bool required)
    {
        var value = Fields.OptionalString(body, key)?.Trim() ?? "";
        if (required && value.Length == 0)
        {
            throw ApiException.Validation($"{key} is required.");
        }

        if (value.Length > max)
        {
            throw ApiException.Validation($"{key} must be {max} characters or less.");
        }

        return value;
    }
}

public static class EmailTemplatesEndpoints
{
    public static void MapEmailTemplatesEndpoints(this IEndpointRouteBuilder app)
    {
        var templates = app.MapGroup("/organizations/{organizationId:guid}/email-templates").RequireAuthorization();
        templates.MapGet("", async Task<Ok<ListResponse<EmailTemplateDto>>> (Guid organizationId, EmailTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(organizationId, ct)));
        templates.MapGet("/{id:guid}", async Task<Ok<EmailTemplateDto>> (Guid organizationId, Guid id, EmailTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(organizationId, id, ct)));
        templates.MapPatch("/{id:guid}", async Task<Ok<EmailTemplateDto>> (Guid organizationId, Guid id, HttpContext context, EmailTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(organizationId, id, await Body.Read(context), ct)));
        templates.MapPost("/{id:guid}/reset", async Task<Ok<EmailTemplateDto>> (Guid organizationId, Guid id, EmailTemplatesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Reset(organizationId, id, ct)));
    }
}
