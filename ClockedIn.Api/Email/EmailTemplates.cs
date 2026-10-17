using System.Net;
using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ClockedIn.Api.Email;

static class EmailTemplates
{
    static readonly Regex Placeholder = new(@"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", RegexOptions.Compiled);
    static readonly Regex SubjectBreaks = new(@"[\r\n]+", RegexOptions.Compiled);
    static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    static readonly IReadOnlyDictionary<string, EmailTemplate> Catalog = Load();

    public static (string Subject, string Html, string Text) Fill(string id, IReadOnlyDictionary<string, string> variables)
    {
        if (!Catalog.TryGetValue(id, out var template))
        {
            throw new InvalidOperationException($"Unknown email template {id}.");
        }

        foreach (var name in template.Variables)
        {
            if (!variables.TryGetValue(name, out var value) || value is null)
            {
                throw new InvalidOperationException($"Missing email variable {name}.");
            }
        }

        return (
            Apply(template.Subject, variables, static value => SubjectBreaks.Replace(value, " ")),
            Apply(template.Html, variables, WebUtility.HtmlEncode),
            Apply(template.Text, variables, static value => value));
    }

    static string Apply(string template, IReadOnlyDictionary<string, string> variables, Func<string, string> encode)
    {
        return Placeholder.Replace(template, match =>
        {
            var name = match.Groups[1].Value;
            return variables.TryGetValue(name, out var value) && value is not null ? encode(value) : match.Value;
        });
    }

    static IReadOnlyDictionary<string, EmailTemplate> Load()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("ClockedIn.Api.Email.messages.json");
        if (stream is null)
        {
            throw new InvalidOperationException("Email templates are missing.");
        }

        return JsonSerializer.Deserialize<Dictionary<string, EmailTemplate>>(stream, JsonOptions)
            ?? throw new InvalidOperationException("Email templates are missing.");
    }

    sealed class EmailTemplate
    {
        public string Subject { get; init; } = "";
        public string Html { get; init; } = "";
        public string Text { get; init; } = "";
        public string[] Variables { get; init; } = [];
    }
}
