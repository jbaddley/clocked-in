using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.GitHub;
using ClockedIn.Api.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Features.Feedback;

public sealed class FeedbackService(
    ClockedInDbContext db,
    Access access,
    IEmailSender mail,
    IGithubIssues github,
    IOptions<EmailOptions> emailOptions,
    TimeProvider time)
{
    public async Task<FeedbackDto> Create(CreateFeedbackRequest request, CancellationToken cancellationToken)
    {
        Organization? organization = null;
        if (request.OrganizationId is { } organizationId)
        {
            organization = await db.Organizations.AsNoTracking()
                .FirstOrDefaultAsync(item => item.Id == organizationId, cancellationToken) ?? throw ApiException.NotFound();
        }

        var now = time.UtcNowToSecond();
        var feedback = new Entities.Feedback
        {
            Id = Guid.NewGuid(),
            UserId = access.RequireHuman().Id,
            OrganizationId = request.OrganizationId,
            Type = request.Type,
            Priority = request.Priority,
            Area = request.Area,
            Title = request.Title,
            Description = request.Description,
            ScreenshotUrls = request.ScreenshotUrls,
            Status = FeedbackStatus.Pending,
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.Feedback.Add(feedback);
        await db.SaveOrThrowAsync(cancellationToken);

        var user = await db.UsersWithProfile().AsNoTracking()
            .FirstAsync(item => item.Id == access.ActorUserId, cancellationToken);
        feedback.User = user;
        feedback.Organization = organization;
        await NotifyCreated(feedback, cancellationToken);
        await TryOpenGithubIssue(feedback, cancellationToken);
        return FeedbackDto.From(feedback, includeActions: false);
    }

    public async Task<ListResponse<FeedbackDto>> List(FeedbackFilter filter, CancellationToken cancellationToken)
    {
        RequireSuperAdmin();
        var page = Fields.Page(filter.Limit, filter.Offset);
        var active = Fields.QueryBool(filter.Active, "active");
        var query = db.Feedback.AsNoTracking()
            .Include(item => item.User).ThenInclude(user => user.Profile)
            .Include(item => item.Organization)
            .AsQueryable();
        FeedbackStatus[] activeStatuses =
        [
            FeedbackStatus.Pending,
            FeedbackStatus.Acknowledged,
            FeedbackStatus.Planned,
            FeedbackStatus.InProgress,
        ];
        if (active is true)
        {
            query = query.Where(item => activeStatuses.Contains(item.Status));
        }
        else if (active is false)
        {
            query = query.Where(item => !activeStatuses.Contains(item.Status));
        }

        if (!string.IsNullOrEmpty(filter.Type))
        {
            var type = Fields.NormalizeFeedbackType(filter.Type);
            query = query.Where(item => item.Type == type);
        }

        if (!string.IsNullOrEmpty(filter.Priority))
        {
            var priority = Fields.NormalizeFeedbackPriority(filter.Priority);
            query = query.Where(item => item.Priority == priority);
        }

        if (!string.IsNullOrEmpty(filter.Area))
        {
            var area = Fields.NormalizeFeedbackArea(filter.Area);
            query = query.Where(item => item.Area == area);
        }

        if (!string.IsNullOrEmpty(filter.Status))
        {
            var status = Fields.NormalizeFeedbackStatus(filter.Status);
            query = query.Where(item => item.Status == status);
        }

        var descending = filter.Order != "asc";
        query = (filter.Sort, descending) switch
        {
            ("title", true) => query.OrderByDescending(item => item.Title),
            ("title", false) => query.OrderBy(item => item.Title),
            ("status", true) => query.OrderByDescending(item => item.Status),
            ("status", false) => query.OrderBy(item => item.Status),
            ("priority", true) => query.OrderByDescending(item => item.Priority),
            ("priority", false) => query.OrderBy(item => item.Priority),
            ("type", true) => query.OrderByDescending(item => item.Type),
            ("type", false) => query.OrderBy(item => item.Type),
            ("area", true) => query.OrderByDescending(item => item.Area),
            ("area", false) => query.OrderBy(item => item.Area),
            (_, true) => query.OrderByDescending(item => item.CreatedAt),
            _ => query.OrderBy(item => item.CreatedAt),
        };

        var items = await query.Skip(page.Offset).Take(page.Limit).ToListAsync(cancellationToken);
        return ListResponse.Of(items.Select(item => FeedbackDto.From(item, includeActions: false)).ToList(), page);
    }

    public async Task<FeedbackDto> Get(Guid feedbackId, CancellationToken cancellationToken)
    {
        var feedback = await Load(feedbackId, cancellationToken);
        await RequireEditor(feedback, cancellationToken);
        return FeedbackDto.From(feedback, includeActions: true);
    }

    public async Task<FeedbackDto> Edit(Guid feedbackId, EditFeedbackRequest request, CancellationToken cancellationToken)
    {
        var feedback = await Load(feedbackId, cancellationToken);
        await RequireEditor(feedback, cancellationToken);
        feedback.Type = request.Type;
        feedback.Priority = request.Priority;
        feedback.Area = request.Area;
        feedback.Title = request.Title;
        feedback.Description = request.Description;
        feedback.UpdatedAt = time.UtcNowToSecond();
        await db.SaveOrThrowAsync(cancellationToken);
        return FeedbackDto.From(feedback, includeActions: true);
    }

    public async Task<FeedbackDto> Update(Guid feedbackId, UpdateFeedbackRequest request, CancellationToken cancellationToken)
    {
        RequireSuperAdmin();
        var feedback = await Load(feedbackId, cancellationToken);
        var previous = feedback.Status;
        var now = time.UtcNowToSecond();
        feedback.Status = request.Status;
        feedback.UpdatedAt = now;
        var action = new FeedbackAction
        {
            Id = Guid.NewGuid(),
            FeedbackId = feedback.Id,
            PreviousStatus = previous,
            UpdatedStatus = request.Status,
            UpdatedAt = now,
            Description = request.Description,
            TakenByUserId = access.RequireHuman().Id,
            TicketUrl = request.TicketUrl,
        };
        if (feedback.TicketUrl is null && request.TicketUrl is not null)
        {
            feedback.TicketUrl = request.TicketUrl;
        }

        db.FeedbackActions.Add(action);
        await db.SaveOrThrowAsync(cancellationToken);
        if (feedback.GithubIssueNumber is { } issueNumber)
        {
            await github.SyncState(issueNumber, request.Status, cancellationToken);
        }

        if (!Entities.Feedback.IsCompleted(previous) && Entities.Feedback.IsCompleted(request.Status))
        {
            await TrySend(
                feedback.User.Email,
                feedback.OrganizationId,
                EmailTemplateFor.FeedbackCompleted,
                new Dictionary<string, string?>
                {
                    ["user.firstName"] = FirstName(feedback.User),
                    ["feedback.title"] = feedback.Title,
                    ["feedback.typeLabel"] = TypeLabel(feedback.Type),
                    ["feedback.outcome"] = Outcome(request.Status),
                    ["feedback.note"] = request.Description,
                },
                cancellationToken);
        }

        return FeedbackDto.From(await Load(feedbackId, cancellationToken), includeActions: true);
    }

    private async Task<Entities.Feedback> Load(Guid feedbackId, CancellationToken cancellationToken) =>
        await db.Feedback
            .Include(item => item.User).ThenInclude(user => user.Profile)
            .Include(item => item.Organization)
            .Include(item => item.Actions).ThenInclude(action => action.TakenBy).ThenInclude(user => user.Profile)
            .FirstOrDefaultAsync(item => item.Id == feedbackId, cancellationToken) ?? throw ApiException.NotFound();

    private void RequireSuperAdmin()
    {
        if (access.IsApiKey || !access.IsSuperAdmin)
        {
            throw ApiException.Forbidden();
        }
    }

    private async Task RequireEditor(Entities.Feedback feedback, CancellationToken cancellationToken)
    {
        if (access.IsApiKey)
        {
            throw ApiException.Forbidden();
        }

        access.RequireHuman();
        if (access.IsSuperAdmin || access.ActorUserId == feedback.UserId)
        {
            return;
        }

        if (feedback.OrganizationId is { } organizationId && await access.IsOrgAdmin(organizationId, cancellationToken))
        {
            return;
        }

        throw ApiException.Forbidden();
    }

    private async Task NotifyCreated(Entities.Feedback feedback, CancellationToken cancellationToken)
    {
        var sent = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await TrySend(
            feedback.User.Email,
            feedback.OrganizationId,
            EmailTemplateFor.FeedbackReceived,
            new Dictionary<string, string?>
            {
                ["user.firstName"] = FirstName(feedback.User),
                ["feedback.title"] = feedback.Title,
                ["feedback.typeLabel"] = TypeLabel(feedback.Type),
            },
            cancellationToken);
        sent.Add(feedback.User.Email);

        var notify = new Dictionary<string, string?>
        {
            ["feedback.submitterName"] = DisplayName(feedback.User),
            ["feedback.typeLabel"] = TypeLabel(feedback.Type),
            ["feedback.priorityLabel"] = feedback.Priority.ToString(),
            ["feedback.areaLabel"] = AreaLabel(feedback.Area),
            ["feedback.title"] = feedback.Title,
            ["feedback.description"] = feedback.Description,
            ["feedback.url"] = emailOptions.Value.Link("/feedback"),
        };
        var superAdmins = await db.Users.AsNoTracking()
            .Where(user => user.IsSuperAdmin)
            .Select(user => user.Email)
            .ToListAsync(cancellationToken);
        foreach (var email in superAdmins)
        {
            if (sent.Add(email))
            {
                await TrySend(email, feedback.OrganizationId, EmailTemplateFor.FeedbackNotify, notify, cancellationToken);
            }
        }

        if (feedback.OrganizationId is not { } organizationId)
        {
            return;
        }

        var organization = await db.Organizations.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == organizationId, cancellationToken);
        var notifyIds = organization?.Preferences.FeedbackNotifyUserIds ?? [];
        if (notifyIds.Count == 0)
        {
            return;
        }

        var recipients = await db.OrganizationMemberships.AsNoTracking()
            .Where(membership =>
                membership.OrganizationId == organizationId
                && membership.IsActive
                && notifyIds.Contains(membership.UserId))
            .Select(membership => membership.User.Email)
            .ToListAsync(cancellationToken);
        foreach (var email in recipients)
        {
            if (sent.Add(email))
            {
                await TrySend(email, feedback.OrganizationId, EmailTemplateFor.FeedbackNotify, notify, cancellationToken);
            }
        }
    }

    private async Task TryOpenGithubIssue(Entities.Feedback feedback, CancellationToken cancellationToken)
    {
        try
        {
            var issue = await github.Create(
                new GithubIssueDraft(
                    feedback.Id,
                    feedback.Title,
                    feedback.Type,
                    feedback.Priority,
                    feedback.Area,
                    feedback.Description,
                    feedback.ScreenshotUrls,
                    DisplayName(feedback.User),
                    feedback.User.Username,
                    feedback.Organization?.Name,
                    emailOptions.Value.Link($"/feedback/{feedback.Id}")),
                cancellationToken);
            if (issue is null)
            {
                return;
            }

            await db.Feedback
                .Where(item => item.Id == feedback.Id)
                .ExecuteUpdateAsync(
                    setters => setters
                        .SetProperty(item => item.GithubIssueNumber, issue.Number)
                        .SetProperty(item => item.TicketUrl, issue.HtmlUrl),
                    cancellationToken);
            feedback.GithubIssueNumber = issue.Number;
            feedback.TicketUrl = issue.HtmlUrl;
        }
        catch (Exception)
        {
        }
    }

    private async Task TrySend(
        string to,
        Guid? organizationId,
        EmailTemplateFor kind,
        IReadOnlyDictionary<string, string?> context,
        CancellationToken cancellationToken)
    {
        try
        {
            await mail.Send(to, organizationId, kind, context, cancellationToken);
        }
        catch (ApiException)
        {
        }
    }

    private static string FirstName(User user) =>
        string.IsNullOrWhiteSpace(user.Profile?.FirstName) ? user.Username : user.Profile.FirstName;

    private static string DisplayName(User user)
    {
        var display = user.Profile?.DisplayName?.Trim();
        if (!string.IsNullOrEmpty(display))
        {
            return display;
        }

        var combined = user.Profile is { } profile ? $"{profile.FirstName} {profile.LastName}".Trim() : "";
        return combined.Length > 0 ? combined : user.Username;
    }

    private static string TypeLabel(FeedbackType type) => type == FeedbackType.Feature ? "feature request" : "bug";

    private static string AreaLabel(FeedbackArea area) => area switch
    {
        FeedbackArea.LogTime => "Log time",
        _ => area.ToString(),
    };

    private static string Outcome(FeedbackStatus status) => status switch
    {
        FeedbackStatus.Resolved => "we completed the work you asked for",
        FeedbackStatus.Cancelled => "we are not going to proceed with this",
        _ => "we were not able to reproduce this",
    };
}
