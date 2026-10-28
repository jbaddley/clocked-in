namespace ClockedIn.Api.OpenApi;

internal static class OpenApiTags
{
    public static readonly (string Needle, string Tag)[] Rules =
    [
        ("/platform", "Platform"),
        ("/api-keys", "API keys"),
        ("/memberships", "Memberships"),
        ("/connections", "Connections"),
        ("/invitations", "Invitations"),
        ("/themes", "Themes"),
        ("/hourly-rates", "Hourly rates"),
        ("/task-categories", "Task categories"),
        ("/imports", "Imports"),
        ("/departments", "Departments"),
        ("/projects", "Projects"),
        ("/time-entries.csv", "Reports"),
        ("/access-requests", "Access requests"),
        ("/time-entries", "Time entries"),
        ("/summary.csv", "Reports"),
        ("/report", "Reports"),
        ("/collective-time-entries", "Collective time"),
        ("/volunteer-needs", "Volunteer needs"),
        ("/tags", "Tags"),
        ("/feedback", "Feedback"),
        ("/auth", "Auth"),
        ("/users", "Users"),
        ("/roles", "Roles"),
        ("/time/", "Time"),
        ("/health", "Health"),
        ("/organizations", "Organizations"),
    ];

    public static IReadOnlyList<string> All => Rules.Select(rule => rule.Tag).Distinct().ToArray();

    public static string For(string path) =>
        Rules.FirstOrDefault(rule => path.Contains(rule.Needle, StringComparison.Ordinal)).Tag ?? "Other";
}
