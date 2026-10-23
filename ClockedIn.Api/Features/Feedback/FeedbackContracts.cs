using System.Text.Json.Nodes;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Feedback;

public sealed record FeedbackPersonDto(Guid Id, string Username, string Email, string? DisplayName)
{
    public static FeedbackPersonDto From(User user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.Profile?.DisplayName
            ?? (user.Profile is { } profile ? $"{profile.FirstName} {profile.LastName}".Trim() : null));
}

public sealed record FeedbackOrganizationDto(Guid Id, string Name)
{
    public static FeedbackOrganizationDto? From(Organization? organization) =>
        organization is null ? null : new(organization.Id, organization.Name);
}

public sealed record FeedbackActionDto(
    Guid Id,
    Guid FeedbackId,
    string PreviousStatus,
    string UpdatedStatus,
    DateTime UpdatedAt,
    string Description,
    Guid TakenByUserId,
    string? TicketUrl,
    FeedbackPersonDto TakenBy)
{
    public static FeedbackActionDto From(FeedbackAction action) => new(
        action.Id,
        action.FeedbackId,
        action.PreviousStatus.ToString(),
        action.UpdatedStatus.ToString(),
        action.UpdatedAt,
        action.Description,
        action.TakenByUserId,
        action.TicketUrl,
        FeedbackPersonDto.From(action.TakenBy));
}

public sealed record FeedbackDto(
    Guid Id,
    Guid UserId,
    Guid? OrganizationId,
    string Type,
    string Priority,
    string Area,
    string Title,
    string Description,
    IReadOnlyList<string> ScreenshotUrls,
    string Status,
    bool Active,
    bool Completed,
    int? GithubIssueNumber,
    string? TicketUrl,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    FeedbackPersonDto User,
    FeedbackOrganizationDto? Organization,
    IReadOnlyList<FeedbackActionDto> Actions)
{
    public static FeedbackDto From(Entities.Feedback feedback, bool includeActions) => new(
        feedback.Id,
        feedback.UserId,
        feedback.OrganizationId,
        feedback.Type.ToString(),
        feedback.Priority.ToString(),
        feedback.Area.ToString(),
        feedback.Title,
        feedback.Description,
        feedback.ScreenshotUrls,
        feedback.Status.ToString(),
        Entities.Feedback.IsActive(feedback.Status),
        Entities.Feedback.IsCompleted(feedback.Status),
        feedback.GithubIssueNumber,
        feedback.TicketUrl,
        feedback.CreatedAt,
        feedback.UpdatedAt,
        FeedbackPersonDto.From(feedback.User),
        FeedbackOrganizationDto.From(feedback.Organization),
        includeActions
            ? feedback.Actions.OrderBy(action => action.UpdatedAt).Select(FeedbackActionDto.From).ToList()
            : []);
}

public sealed record CreateFeedbackRequest(
    FeedbackType Type,
    FeedbackPriority Priority,
    FeedbackArea Area,
    string Title,
    string Description,
    List<string> ScreenshotUrls,
    Guid? OrganizationId)
{
    public static async ValueTask<CreateFeedbackRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreateFeedbackRequest Parse(JsonObject body) => new(
        Fields.NormalizeFeedbackType(Fields.RequiredString(body, "type")),
        Fields.NormalizeFeedbackPriority(Fields.RequiredString(body, "priority")),
        Fields.NormalizeFeedbackArea(Fields.RequiredString(body, "area")),
        Fields.FeedbackTitle(Fields.RequiredString(body, "title")),
        Fields.RequiredLongText(body, "description", 4000),
        Fields.ScreenshotUrls(body),
        Fields.OptionalGuid(body, "organizationId"));
}

public sealed record EditFeedbackRequest(
    FeedbackType Type,
    FeedbackPriority Priority,
    FeedbackArea Area,
    string Title,
    string Description)
{
    public static EditFeedbackRequest Parse(JsonObject body) => new(
        Fields.NormalizeFeedbackType(Fields.RequiredString(body, "type")),
        Fields.NormalizeFeedbackPriority(Fields.RequiredString(body, "priority")),
        Fields.NormalizeFeedbackArea(Fields.RequiredString(body, "area")),
        Fields.FeedbackTitle(Fields.RequiredString(body, "title")),
        Fields.RequiredLongText(body, "description", 4000));
}

public sealed record UpdateFeedbackRequest(FeedbackStatus Status, string Description, string? TicketUrl)
{
    public static async ValueTask<UpdateFeedbackRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateFeedbackRequest Parse(JsonObject body) => new(
        Fields.NormalizeFeedbackStatus(Fields.RequiredString(body, "status")),
        Fields.RequiredLongText(body, "description", 2000),
        Fields.TicketUrl(body));
}
