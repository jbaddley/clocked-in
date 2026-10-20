using System.Net.Http.Headers;
using System.Text;
using System.Text.Json.Nodes;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Entities;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.GitHub;

public sealed record GithubIssueDraft(
    Guid FeedbackId,
    string Title,
    FeedbackType Type,
    FeedbackPriority Priority,
    FeedbackArea Area,
    string Description,
    IReadOnlyList<string> ScreenshotUrls,
    string SubmitterName,
    string SubmitterUsername,
    string? OrganizationName,
    string AdminUrl);

public sealed record GithubIssue(int Number, string HtmlUrl);

public interface IGithubIssues
{
    Task<GithubIssue?> Create(GithubIssueDraft draft, CancellationToken cancellationToken);
    Task SyncState(int number, FeedbackStatus status, CancellationToken cancellationToken);
}

public sealed class GithubIssuesClient(HttpClient http, IOptions<GithubOptions> options) : IGithubIssues
{
    public async Task<GithubIssue?> Create(GithubIssueDraft draft, CancellationToken cancellationToken)
    {
        if (!TryRepo(out var owner, out var repo))
        {
            return null;
        }

        var labels = Labels(draft.Type, draft.Priority, draft.Area);
        await TryEnsureLabels(owner, repo, labels, cancellationToken);
        var created = await PostIssue(owner, repo, draft, labels, cancellationToken)
            ?? await PostIssue(owner, repo, draft, [], cancellationToken);
        return created;
    }

    public async Task SyncState(int number, FeedbackStatus status, CancellationToken cancellationToken)
    {
        if (!TryRepo(out var owner, out var repo))
        {
            return;
        }

        var payload = new JsonObject { ["state"] = Feedback.IsActive(status) ? "open" : "closed" };
        if (!Feedback.IsActive(status))
        {
            payload["state_reason"] = status == FeedbackStatus.Resolved ? "completed" : "not_planned";
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Patch, $"repos/{owner}/{repo}/issues/{number}")
            {
                Content = JsonContent(payload),
            };
            using var response = await http.SendAsync(request, cancellationToken);
        }
        catch (Exception)
        {
        }
    }

    private bool TryRepo(out string owner, out string repo)
    {
        owner = "";
        repo = "";
        var settings = options.Value;
        return !string.IsNullOrWhiteSpace(settings.Token) && settings.TryRepo(out owner, out repo);
    }

    private async Task TryEnsureLabels(string owner, string repo, IReadOnlyList<string> labels, CancellationToken cancellationToken)
    {
        foreach (var label in labels)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, $"repos/{owner}/{repo}/labels")
                {
                    Content = JsonContent(new JsonObject
                    {
                        ["name"] = label,
                        ["color"] = LabelColor(label),
                    }),
                };
                using var response = await http.SendAsync(request, cancellationToken);
            }
            catch (HttpRequestException)
            {
            }
        }
    }

    private async Task<GithubIssue?> PostIssue(
        string owner,
        string repo,
        GithubIssueDraft draft,
        IReadOnlyList<string> labels,
        CancellationToken cancellationToken)
    {
        try
        {
            var payload = new JsonObject
            {
                ["title"] = draft.Title,
                ["body"] = Body(draft),
            };
            if (labels.Count > 0)
            {
                var array = new JsonArray();
                foreach (var label in labels)
                {
                    array.Add(label);
                }

                payload["labels"] = array;
            }

            using var request = new HttpRequestMessage(HttpMethod.Post, $"repos/{owner}/{repo}/issues")
            {
                Content = JsonContent(payload),
            };
            using var response = await http.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return null;
            }

            var json = await response.Content.ReadFromJsonAsync<JsonObject>(cancellationToken);
            var number = json?["number"]?.GetValue<int>() ?? 0;
            var htmlUrl = json?["html_url"]?.GetValue<string>();
            return number > 0 && !string.IsNullOrWhiteSpace(htmlUrl) ? new GithubIssue(number, htmlUrl) : null;
        }
        catch (HttpRequestException)
        {
            return null;
        }
    }

    private static StringContent JsonContent(JsonNode payload) =>
        new(payload.ToJsonString(), Encoding.UTF8, "application/json");

    private static IReadOnlyList<string> Labels(FeedbackType type, FeedbackPriority priority, FeedbackArea area) =>
        [type.ToString(), $"priority:{priority}", $"area:{area}"];

    private static string LabelColor(string label) => label switch
    {
        "Bug" => "d73a4a",
        "Feature" => "0e8a16",
        "priority:Urgent" => "b60205",
        "priority:High" => "d93f0b",
        "priority:Medium" => "fbca04",
        "priority:Low" => "0e8a16",
        _ => "cfd3d7",
    };

    private static string Body(GithubIssueDraft draft)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"**Type:** {draft.Type}");
        builder.AppendLine($"**Priority:** {draft.Priority}");
        builder.AppendLine($"**Area:** {(draft.Area == FeedbackArea.LogTime ? "Log time" : draft.Area.ToString())}");
        builder.AppendLine($"**From:** {draft.SubmitterName} (`{draft.SubmitterUsername}`)");
        if (!string.IsNullOrWhiteSpace(draft.OrganizationName))
        {
            builder.AppendLine($"**Organization:** {draft.OrganizationName}");
        }

        builder.AppendLine($"**Clocked In:** {draft.AdminUrl}");
        builder.AppendLine();
        builder.AppendLine(draft.Description);
        foreach (var url in draft.ScreenshotUrls)
        {
            builder.AppendLine();
            builder.AppendLine($"![Screenshot]({url})");
        }

        builder.AppendLine();
        builder.AppendLine($"Clocked In id: `{draft.FeedbackId}`");
        return builder.ToString();
    }
}
