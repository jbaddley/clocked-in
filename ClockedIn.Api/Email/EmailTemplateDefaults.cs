using System.Reflection;
using System.Text;
using System.Text.Json;
using ClockedIn.Api.Entities;

namespace ClockedIn.Api.Email;

public sealed record EmailTemplateDefault(EmailTemplateFor For, string Name, string Subject, string Heading, string Preview, string Html)
{
    public EmailContent Content => new(Subject, Heading, Preview, Html);
}

/// <summary>Default copy from emails/dist/defaults.json (built by npm run email:render).</summary>
public static class EmailTemplateDefaults
{
    static readonly Lazy<IReadOnlyList<EmailTemplateDefault>> Loaded = new(Load);

    public static IReadOnlyList<EmailTemplateDefault> All => Loaded.Value;

    public static EmailTemplateDefault For(EmailTemplateFor kind) =>
        All.FirstOrDefault(item => item.For == kind) ?? throw new InvalidOperationException($"No default email template for {kind}.");

    public static EmailTemplate NewRow(Guid organizationId, EmailTemplateDefault item, DateTime now) => new()
    {
        Id = Guid.NewGuid(),
        OrganizationId = organizationId,
        Name = item.Name,
        Version = 1,
        For = item.For,
        Subject = item.Subject,
        Heading = item.Heading,
        Preview = item.Preview,
        Template = item.Html,
        IsEnabled = true,
        CreatedAt = now,
        UpdatedAt = now,
    };

    public static IEnumerable<EmailTemplate> NewRows(Guid organizationId, DateTime now) =>
        All.Select(item => NewRow(organizationId, item, now));

    /// <summary>Inserts any missing default rows for every organization.</summary>
    public static string BackfillSql()
    {
        var sql = new StringBuilder();
        foreach (var item in All)
        {
            sql.AppendLine($"""
                INSERT INTO "EmailTemplate" ("id", "organizationId", "name", "version", "for", "subject", "heading", "preview", "template", "isEnabled", "createdAt", "updatedAt")
                SELECT gen_random_uuid(), o."id", {Literal(item.Name)}, 1, {Literal(item.For.ToString())}, {Literal(item.Subject)}, {Literal(item.Heading)}, {Literal(item.Preview)}, {Literal(item.Html)}, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                FROM "Organization" o
                ON CONFLICT ("organizationId", "for") DO NOTHING;
                """);
        }

        return sql.ToString();
    }

    static string Literal(string value) => $"'{value.Replace("'", "''")}'";

    static IReadOnlyList<EmailTemplateDefault> Load()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ClockedIn.Api.Email.defaults.json")
            ?? throw new InvalidOperationException("Email template defaults are missing.");
        using var document = JsonDocument.Parse(stream);
        return document.RootElement.EnumerateArray().Select(item => new EmailTemplateDefault(
            Enum.Parse<EmailTemplateFor>(item.GetProperty("for").GetString()!),
            item.GetProperty("name").GetString()!,
            item.GetProperty("subject").GetString()!,
            item.GetProperty("heading").GetString()!,
            item.GetProperty("preview").GetString()!,
            item.GetProperty("html").GetString()!)).ToList();
    }
}
