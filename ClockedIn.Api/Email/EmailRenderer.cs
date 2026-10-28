using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using ClockedIn.Api.Entities;

namespace ClockedIn.Api.Email;

public sealed record EmailContent(string Subject, string Heading, string Preview, string Template);

/// <summary>Mirror of src/lib/email/templates.ts. Context keys are dotted paths such as organization.name.</summary>
public static partial class EmailRenderer
{
    public static readonly IReadOnlyList<EmailTemplateFor> Optional = [EmailTemplateFor.LoggedTime, EmailTemplateFor.UnclassifiedEntry];

    public static readonly IReadOnlyDictionary<EmailTemplateFor, string[]> Fields = new Dictionary<EmailTemplateFor, string[]>
    {
        [EmailTemplateFor.Invite] = ["organization.name", "invite.targetKind", "invite.targetName", "invite.roleName", "user.username", "invite.code", "invite.url"],
        [EmailTemplateFor.Welcome] = ["organization.name", "user.username", "user.password", "account.url"],
        [EmailTemplateFor.PasswordReset] = ["reset.code", "reset.url"],
        [EmailTemplateFor.LoggedTime] = ["user.firstName", "organization.name", "entry.hours", "entry.date", "entry.url"],
        [EmailTemplateFor.UnclassifiedEntry] = ["user.firstName", "entry.url"],
        [EmailTemplateFor.FeedbackReceived] = ["user.firstName", "feedback.title", "feedback.typeLabel"],
        [EmailTemplateFor.FeedbackNotify] = ["feedback.submitterName", "feedback.typeLabel", "feedback.priorityLabel", "feedback.areaLabel", "feedback.title", "feedback.description", "feedback.url"],
        [EmailTemplateFor.FeedbackCompleted] = ["user.firstName", "feedback.title", "feedback.typeLabel", "feedback.outcome", "feedback.note"],
        [EmailTemplateFor.AccessRequestReceived] = ["organization.name", "request.requesterEmail"],
        [EmailTemplateFor.AccessRequestDecided] = ["organization.name", "request.decision", "user.name"],
        [EmailTemplateFor.NeedSubmitted] = ["organization.name", "need.name", "need.managerName"],
        [EmailTemplateFor.NeedDecided] = ["organization.name", "need.name", "need.decision"],
        [EmailTemplateFor.VolunteerMessage] = ["message.subject", "message.body", "need.name"],
    };

    static readonly HashSet<string> AllowedTags = ["p", "h1", "h2", "h3", "strong", "em", "a", "ul", "ol", "li", "br", "span"];
    static readonly HashSet<string> DroppedWithContent = ["script", "style", "head", "title", "iframe", "object", "embed", "textarea", "noscript", "template", "svg", "math"];

    const string Primary = "#001836";
    const string Highlight = "#D4AC59";
    const string Success = "#4EBFAE";
    const string Surface = "#FFFFFF";
    const string Muted = "#5C6B7A";
    const string Page = "#F4F6F8";
    const string Rule = "#E6E8EB";
    const string FontFamily = "\"Nunito Sans\", \"Segoe UI\", Helvetica, Arial, sans-serif";

    static readonly Dictionary<string, string> TagStyles = new()
    {
        ["p"] = $"color:{Primary};font-size:16px;line-height:24px;margin:0 0 16px",
        ["h1"] = $"color:{Primary};font-size:24px;line-height:30px;font-weight:700;margin:0 0 16px",
        ["h2"] = $"color:{Primary};font-size:20px;line-height:28px;font-weight:700;margin:0 0 14px",
        ["h3"] = $"color:{Primary};font-size:17px;line-height:24px;font-weight:700;margin:0 0 12px",
        ["ul"] = $"color:{Primary};font-size:16px;line-height:24px;margin:0 0 16px;padding-left:22px",
        ["ol"] = $"color:{Primary};font-size:16px;line-height:24px;margin:0 0 16px;padding-left:22px",
        ["li"] = "margin:0 0 6px",
        ["a"] = $"color:{Primary};text-decoration:underline",
        ["em"] = $"color:{Muted}",
    };

    const string CodeBox = $"background-color:#FBF7EE;border:1px solid {Highlight};border-radius:10px;margin:0 0 20px;padding:18px 12px";
    const string CodeText = $"color:{Primary};font-size:32px;font-weight:700;letter-spacing:0.18em;line-height:40px;margin:0;text-align:center";

    public static IReadOnlyList<string> PlaceholdersIn(params string[] texts)
    {
        var found = new List<string>();
        foreach (var text in texts)
        {
            foreach (Match match in Placeholder().Matches(text))
            {
                var path = match.Groups[1].Value;
                if (!found.Contains(path))
                {
                    found.Add(path);
                }
            }
        }

        return found;
    }

    public static IReadOnlyList<string> UnknownPlaceholders(EmailTemplateFor kind, params string[] texts) =>
        PlaceholdersIn(texts).Where(path => !Fields[kind].Contains(path)).ToList();

    public static string Fill(string source, IReadOnlyDictionary<string, string?> context, Func<string, string> encode) =>
        Placeholder().Replace(source, match =>
            context.TryGetValue(match.Groups[1].Value, out var value) && value is not null ? encode(value) : match.Value);

    public static (string Subject, string Html, string Text) Render(EmailContent content, IReadOnlyDictionary<string, string?> context)
    {
        var missing = PlaceholdersIn(content.Subject, content.Heading, content.Preview, content.Template)
            .FirstOrDefault(path => !context.TryGetValue(path, out var value) || value is null);
        if (missing is not null)
        {
            throw new InvalidOperationException($"Missing email field {missing}.");
        }

        var heading = Fill(WebUtility.HtmlEncode(content.Heading), context, EncodeWithBreaks);
        var preview = Fill(WebUtility.HtmlEncode(content.Preview), context, WebUtility.HtmlEncode);
        var body = Fill(StyleBody(content.Template), context, EncodeWithBreaks);
        var plainHeading = Fill(content.Heading, context, static value => value);
        var plainBody = Fill(HtmlToText(content.Template), context, static value => value);
        return (
            Fill(content.Subject, context, static value => SubjectBreaks().Replace(value, " ")),
            Wrap(heading, preview, body),
            $"{plainHeading}\n\n{plainBody}\n\nEvery volunteer hour, counted and valued.");
    }

    /// <summary>Rebuilds every tag from an allowlist, so nothing outside it reaches a stored template.</summary>
    public static string Sanitize(string html)
    {
        var output = new StringBuilder();
        var index = 0;
        string? skipUntil = null;
        foreach (Match match in Tag().Matches(html))
        {
            var closing = match.Groups[1].Value == "/";
            var tag = match.Groups[2].Value.ToLowerInvariant();
            if (skipUntil is not null)
            {
                if (closing && tag == skipUntil)
                {
                    skipUntil = null;
                    index = match.Index + match.Length;
                }

                continue;
            }

            output.Append(EscapeText(html[index..match.Index]));
            index = match.Index + match.Length;
            if (!match.Groups[2].Success)
            {
                continue;
            }

            if (DroppedWithContent.Contains(tag))
            {
                if (!closing && !SelfClosing().IsMatch(match.Groups[3].Value))
                {
                    skipUntil = tag;
                }

                continue;
            }

            if (!AllowedTags.Contains(tag))
            {
                continue;
            }

            if (tag == "br")
            {
                if (!closing)
                {
                    output.Append("<br>");
                }

                continue;
            }

            if (closing)
            {
                output.Append($"</{tag}>");
                continue;
            }

            var attributes = Attributes(match.Groups[3].Value);
            if (tag == "a")
            {
                var href = (attributes.GetValueOrDefault("href") ?? "").Trim().Replace("&amp;", "&");
                output.Append(SafeHref().IsMatch(href) ? $"<a href=\"{EscapeAttribute(href)}\">" : "<a>");
            }
            else if (tag == "span")
            {
                var path = attributes.GetValueOrDefault("data-placeholder") ?? "";
                output.Append(PlaceholderPath().IsMatch(path) ? $"<span data-placeholder=\"{path}\">" : "<span>");
            }
            else
            {
                output.Append($"<{tag}>");
            }
        }

        if (skipUntil is null)
        {
            output.Append(EscapeText(html[index..]));
        }

        return output.ToString();
    }

    public static string StyleBody(string html)
    {
        var boxed = CodeParagraph().Replace(html, match => $"<div style=\"{CodeBox}\"><p style=\"{CodeText}\">{match.Groups[1].Value}</p></div>");
        var styled = StyledTag().Replace(boxed, match => $"<{match.Groups[1].Value} style=\"{TagStyles[match.Groups[1].Value]}\">");
        return styled.Replace("<a href=\"", $"<a style=\"{TagStyles["a"]}\" href=\"");
    }

    public static string Wrap(string heading, string preview, string body) => string.Concat(
        "<!DOCTYPE html><html lang=\"en\"><head><meta content=\"text/html; charset=UTF-8\" http-equiv=\"Content-Type\"><meta name=\"x-apple-disable-message-reformatting\"></head>",
        $"<body style=\"background-color:{Page};font-family:{FontFamily};margin:0;padding:32px 12px\">",
        $"<div style=\"display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0\">{preview}</div>",
        $"<table align=\"center\" width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" style=\"background-color:{Surface};border-radius:12px;margin:0 auto;max-width:560px;overflow:hidden\"><tbody><tr><td>",
        $"<div style=\"background-color:{Primary};padding:28px 32px 24px\">",
        $"<p style=\"color:{Highlight};font-size:12px;font-weight:700;letter-spacing:0.16em;line-height:16px;margin:0\">VolunTime</p>",
        $"<h1 style=\"color:{Surface};font-size:28px;font-weight:650;line-height:34px;margin:14px 0 0\">{heading}</h1>",
        $"<div style=\"background-color:{Success};height:3px;margin-top:22px;width:48px\"></div>",
        "</div>",
        $"<div style=\"padding:28px 32px 8px\">{body}</div>",
        $"<hr style=\"border:none;border-top:1px solid {Rule};margin:8px 32px 0\">",
        $"<p style=\"color:{Muted};font-size:13px;line-height:20px;margin:16px 32px 28px\">Every volunteer hour, counted and valued.</p>",
        "</td></tr></tbody></table>",
        $"<p style=\"color:{Muted};font-size:12px;line-height:18px;margin:16px 0 0;text-align:center\">This message was sent by VolunTime.</p>",
        "</body></html>");

    public static string HtmlToText(string html)
    {
        var text = Link().Replace(html, match =>
        {
            var href = match.Groups[1].Value;
            var inner = AnyTag().Replace(match.Groups[2].Value, "");
            return inner.Trim() == href.Trim() ? inner : $"{inner} ({href})";
        });
        text = LineBreak().Replace(text, "\n");
        text = ListItem().Replace(text, "- ");
        text = BlockEnd().Replace(text, "\n\n");
        text = ListEnd().Replace(text, "\n");
        text = AnyTag().Replace(text, "");
        text = WebUtility.HtmlDecode(text);
        text = TrailingSpace().Replace(text, "\n");
        text = ExtraLines().Replace(text, "\n\n");
        return text.Trim();
    }

    static string EncodeWithBreaks(string value) => NewLine().Replace(WebUtility.HtmlEncode(value), "<br>");

    static string EscapeText(string text) => BareAmpersand().Replace(text, "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");

    static string EscapeAttribute(string value) => EscapeText(value).Replace("\"", "&quot;");

    static Dictionary<string, string> Attributes(string source)
    {
        var values = new Dictionary<string, string>();
        foreach (Match match in Attribute().Matches(source))
        {
            var value = match.Groups[2].Success ? match.Groups[2].Value
                : match.Groups[3].Success ? match.Groups[3].Value
                : match.Groups[4].Value;
            values[match.Groups[1].Value.ToLower(CultureInfo.InvariantCulture)] = value;
        }

        return values;
    }

    [GeneratedRegex(@"\{\{\s*([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\}\}")]
    private static partial Regex Placeholder();

    [GeneratedRegex(@"^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$")]
    private static partial Regex PlaceholderPath();

    [GeneratedRegex(@"[\r\n]+")]
    private static partial Regex SubjectBreaks();

    [GeneratedRegex(@"\r?\n")]
    private static partial Regex NewLine();

    [GeneratedRegex(@"<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>""']|""[^""]*""|'[^']*')*)>")]
    private static partial Regex Tag();

    [GeneratedRegex(@"([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:""([^""]*)""|'([^']*)'|([^\s""'=<>`]+)))?")]
    private static partial Regex Attribute();

    [GeneratedRegex(@"\/\s*$")]
    private static partial Regex SelfClosing();

    [GeneratedRegex(@"^(?:https?:\/\/|mailto:|\{\{)", RegexOptions.IgnoreCase)]
    private static partial Regex SafeHref();

    [GeneratedRegex(@"&(?!(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)")]
    private static partial Regex BareAmpersand();

    [GeneratedRegex(@"<p>\s*((?:<span data-placeholder=""[^""]*"">)?\{\{\s*[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*\.code\s*\}\}(?:<\/span>)?)\s*<\/p>")]
    private static partial Regex CodeParagraph();

    [GeneratedRegex(@"<(p|h1|h2|h3|ul|ol|li|em)>")]
    private static partial Regex StyledTag();

    [GeneratedRegex(@"<a\b[^>]*href=""([^""]*)""[^>]*>([\s\S]*?)<\/a>")]
    private static partial Regex Link();

    [GeneratedRegex(@"<br\s*\/?>")]
    private static partial Regex LineBreak();

    [GeneratedRegex(@"<li[^>]*>")]
    private static partial Regex ListItem();

    [GeneratedRegex(@"<\/(p|h1|h2|h3)>")]
    private static partial Regex BlockEnd();

    [GeneratedRegex(@"<\/(li|ul|ol)>")]
    private static partial Regex ListEnd();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex AnyTag();

    [GeneratedRegex(@"[ \t]+\n")]
    private static partial Regex TrailingSpace();

    [GeneratedRegex(@"\n{3,}")]
    private static partial Regex ExtraLines();
}
