namespace ClockedIn.Api.Features.Shared;

public static class Permissions
{
    public static readonly string[] All =
    [
        "manage_organization",
        "manage_roles",
        "manage_members",
        "invite_members",
        "import_people",
        "approve_access_requests",
        "log_own_time",
        "log_member_time",
        "log_group_sessions",
        "log_event_totals",
        "view_reports",
        "export_reports",
        "design_reports",
        "create_needs",
        "approve_needs",
        "create_projects",
        "archive_projects",
        "manage_lists",
        "manage_connections",
        "manage_api_keys",
    ];

    public static readonly string[] Staff = ["log_own_time", "view_reports", "export_reports"];

    public static readonly string[] Volunteer = ["log_own_time"];

    public static readonly string[] GroupManager =
    [
        "invite_members",
        "log_own_time",
        "log_member_time",
        "log_group_sessions",
        "log_event_totals",
        "view_reports",
        "export_reports",
        "create_needs",
        "create_projects",
    ];

    public static readonly string[] WriteKey =
    [
        "log_own_time",
        "log_member_time",
        "log_group_sessions",
        "log_event_totals",
        "view_reports",
        "export_reports",
        "create_needs",
        "create_projects",
        "manage_lists",
    ];

    public static readonly string[] ReadKey = ["view_reports", "export_reports"];

    public static IReadOnlyList<string> DefaultForCode(string? code) => code switch
    {
        "ADMIN" => All,
        "MEMBER" => Staff,
        "VOLUNTEER" => Volunteer,
        _ => Volunteer,
    };

    public static string DefaultScopeForCode(string? code) =>
        code == "VOLUNTEER" ? "self" : "organization";

    public static IReadOnlyList<string> ForApiKey(bool isAdmin, bool canWrite) =>
        isAdmin ? All : canWrite ? WriteKey : ReadKey;

    public static bool IsKnown(string permission) => All.Contains(permission);

    public static string NormalizeScope(string value)
    {
        var scope = value.Trim();
        if (scope is not ("organization" or "assigned_groups" or "self"))
        {
            throw Http.ApiException.Validation("scope must be organization, assigned_groups, or self.");
        }

        return scope;
    }
}
