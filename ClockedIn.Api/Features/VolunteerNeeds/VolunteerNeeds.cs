using System.Security.Cryptography;
using System.Text.Json.Nodes;
using ClockedIn.Api.Data;
using ClockedIn.Api.Email;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.VolunteerNeeds;

public sealed record VolunteerNeedDto(
    Guid Id,
    Guid OrganizationId,
    Guid CreatedByUserId,
    string PublicToken,
    string Name,
    string? Description,
    string Type,
    int CountNeeded,
    int CountVetted,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime? RequiredBy,
    bool AllowPublic,
    bool RequireVetting,
    NeedFormDto Questions,
    Guid? ProjectId,
    Guid? TaskCategoryId,
    Guid? DepartmentId,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static VolunteerNeedDto From(VolunteerNeed need) => new(
        need.Id,
        need.OrganizationId,
        need.CreatedByUserId,
        need.PublicToken,
        need.Name,
        need.Description,
        need.Type.ToString(),
        need.CountNeeded,
        need.CountVetted,
        need.StartDate,
        need.EndDate,
        need.RequiredBy,
        need.AllowPublic,
        need.RequireVetting,
        NeedForms.Read(need.Questions),
        need.ProjectId,
        need.TaskCategoryId,
        need.DepartmentId,
        need.CreatedAt,
        need.UpdatedAt);
}

public sealed record PublicVolunteerNeedDto(
    string Name,
    string? Description,
    string Type,
    int CountNeeded,
    int CountVetted,
    int Remaining,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime? RequiredBy,
    bool RequireVetting,
    string? Closed,
    PublicQuestionDto[] Questions,
    string OrganizationName);

public sealed record VolunteerSignupDto(
    Guid Id,
    Guid VolunteerNeedId,
    Guid? UserId,
    Guid? GuestId,
    string Name,
    string Email,
    string? Phone,
    string Kind,
    string? Comment,
    StoredAnswerDto[] Answers,
    bool Passed,
    bool Vetted,
    DateTime CreatedAt,
    Guid? LinkedUserId)
{
    public static VolunteerSignupDto From(VolunteerSignup signup)
    {
        if (signup.User is not null)
        {
            var profile = signup.User.Profile;
            var name = profile?.DisplayName;
            if (string.IsNullOrWhiteSpace(name) && profile is not null)
            {
                name = $"{profile.FirstName} {profile.LastName}".Trim();
            }

            return new(
                signup.Id,
                signup.VolunteerNeedId,
                signup.UserId,
                null,
                string.IsNullOrWhiteSpace(name) ? signup.User.Username : name,
                signup.User.Email,
                profile?.Phone,
                "member",
                signup.Comment,
                NeedForms.Answers(signup.Answers),
                signup.Passed,
                signup.Vetted,
                signup.CreatedAt,
                null);
        }

        var guest = signup.Guest ?? throw new InvalidOperationException("Signup has no person.");
        return new(
            signup.Id,
            signup.VolunteerNeedId,
            null,
            signup.GuestId,
            guest.Name,
            guest.Email,
            guest.Phone,
            "guest",
            signup.Comment,
            NeedForms.Answers(signup.Answers),
            signup.Passed,
            signup.Vetted,
            signup.CreatedAt,
            guest.UserId);
    }
}

public sealed record EmailVolunteersResult(int Sent);

public sealed record VolunteerNeedQuery(
    string? Limit,
    string? Offset,
    string? Q,
    string? Type,
    string? ProjectId,
    string? DepartmentId,
    string? AllowPublic,
    string? Sort,
    string? Order);

public sealed record SaveVolunteerNeedRequest(
    string Name,
    string? Description,
    VolunteerNeedType Type,
    int CountNeeded,
    DateOnly? StartDate,
    DateOnly? EndDate,
    DateTime? RequiredBy,
    bool AllowPublic,
    bool RequireVetting,
    string Questions,
    Guid? ProjectId,
    Guid? TaskCategoryId,
    Guid? DepartmentId)
{
    public static async ValueTask<SaveVolunteerNeedRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static SaveVolunteerNeedRequest Parse(JsonObject body) => new(
        Fields.RequireName(Fields.RequiredString(body, "name"), "name"),
        NeedInput.Description(body, required: false),
        NeedInput.ParseType(Fields.RequiredString(body, "type")),
        NeedInput.Count(Fields.RequiredInt(body, "countNeeded")),
        Fields.OptionalDate(body, "startDate"),
        Fields.OptionalDate(body, "endDate"),
        Fields.OptionalInstant(body, "requiredBy"),
        Fields.Has(body, "allowPublic") && Fields.RequiredBool(body, "allowPublic"),
        Fields.Has(body, "requireVetting") && Fields.RequiredBool(body, "requireVetting"),
        Fields.Has(body, "questions") ? NeedForms.Canonical(body["questions"]) : VolunteerNeed.EmptyQuestions,
        Fields.OptionalGuid(body, "projectId"),
        Fields.OptionalGuid(body, "taskCategoryId"),
        Fields.OptionalGuid(body, "departmentId"));
}

public sealed record UpdateVolunteerNeedRequest(
    Optional<string> Name,
    Optional<string?> Description,
    Optional<VolunteerNeedType> Type,
    Optional<int> CountNeeded,
    Optional<DateOnly?> StartDate,
    Optional<DateOnly?> EndDate,
    Optional<DateTime?> RequiredBy,
    Optional<bool> AllowPublic,
    Optional<bool> RequireVetting,
    Optional<string> Questions,
    Optional<Guid?> ProjectId,
    Optional<Guid?> TaskCategoryId,
    Optional<Guid?> DepartmentId)
{
    public static async ValueTask<UpdateVolunteerNeedRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateVolunteerNeedRequest Parse(JsonObject body)
    {
        var request = new UpdateVolunteerNeedRequest(
            Optional.Read(body, "name", (item, key) => Fields.RequireName(Fields.RequiredString(item, key), key)),
            Optional.Read(body, "description", (item, _) => NeedInput.Description(item, required: true)),
            Optional.Read(body, "type", (item, key) => NeedInput.ParseType(Fields.RequiredString(item, key))),
            Optional.Read(body, "countNeeded", (item, key) => NeedInput.Count(Fields.RequiredInt(item, key))),
            Optional.Read(body, "startDate", Fields.OptionalDate),
            Optional.Read(body, "endDate", Fields.OptionalDate),
            Optional.Read(body, "requiredBy", Fields.OptionalInstant),
            Optional.Read(body, "allowPublic", Fields.RequiredBool),
            Optional.Read(body, "requireVetting", Fields.RequiredBool),
            Optional.Read(body, "questions", (item, key) => NeedForms.Canonical(item[key])),
            Optional.Read(body, "projectId", Fields.OptionalGuid),
            Optional.Read(body, "taskCategoryId", Fields.OptionalGuid),
            Optional.Read(body, "departmentId", Fields.OptionalGuid));
        if (!request.Name.HasValue && !request.Description.HasValue && !request.Type.HasValue
            && !request.CountNeeded.HasValue && !request.StartDate.HasValue && !request.EndDate.HasValue
            && !request.RequiredBy.HasValue && !request.AllowPublic.HasValue && !request.RequireVetting.HasValue
            && !request.Questions.HasValue && !request.ProjectId.HasValue && !request.TaskCategoryId.HasValue
            && !request.DepartmentId.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }
}

public sealed record PublicSignupRequest(
    string? Name,
    string? Email,
    string? Phone,
    string? Comment,
    JsonNode? Answers,
    bool Acknowledged,
    string? CaptchaToken)
{
    public static async ValueTask<PublicSignupRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static PublicSignupRequest Parse(JsonObject body) => new(
        Fields.OptionalString(body, "name"),
        Fields.OptionalString(body, "email"),
        Fields.OptionalString(body, "phone"),
        Fields.OptionalString(body, "comment"),
        body["answers"],
        Fields.Has(body, "acknowledged") && Fields.RequiredBool(body, "acknowledged"),
        Fields.OptionalString(body, "captchaToken"));
}

public sealed record EmailVolunteersRequest(List<Guid> SignupIds, string Subject, string Message)
{
    public static async ValueTask<EmailVolunteersRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static EmailVolunteersRequest Parse(JsonObject body)
    {
        var ids = Fields.Ids(body, "signupIds", optional: false);
        if (ids.Count is < 1 or > 100)
        {
            throw ApiException.Validation("signupIds must contain 1 to 100 ids.");
        }

        var subject = Fields.RequiredString(body, "subject").Trim();
        if (subject.Length is < 1 or > 200)
        {
            throw ApiException.Validation("subject must be 1 to 200 characters.");
        }

        var message = Fields.RequiredString(body, "body").Trim();
        if (message.Length is < 1 or > 5000)
        {
            throw ApiException.Validation("body must be 1 to 5000 characters.");
        }

        return new(ids, subject, message);
    }
}

public static class GuestLinks
{
    public static async Task Attach(ClockedInDbContext db, string email, Guid userId, CancellationToken cancellationToken)
    {
        var guest = await db.Guests.FirstOrDefaultAsync(item => item.Email == email, cancellationToken);
        if (guest is { UserId: null })
        {
            guest.UserId = userId;
        }
    }
}

public sealed class VolunteerNeedsService(
    ClockedInDbContext db,
    Access access,
    CurrentUser current,
    TurnstileVerifier captcha,
    IEmailSender mail,
    TimeProvider time)
{
    public async Task<ListResponse<VolunteerNeedDto>> List(Guid organizationId, VolunteerNeedQuery query, CancellationToken cancellationToken)
    {
        var page = Fields.Page(query.Limit, query.Offset);
        await access.RequireOrganization(organizationId, true, cancellationToken);
        var needs = Filtered(db.VolunteerNeeds.AsNoTracking().Where(need => need.OrganizationId == organizationId), query);
        var items = await Ordered(needs, query.Sort, query.Order)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(items.Select(VolunteerNeedDto.From).ToList(), page);
    }

    public async Task<VolunteerNeedDto> Get(Guid needId, CancellationToken cancellationToken) =>
        VolunteerNeedDto.From(await Managed(needId, cancellationToken));

    public async Task<VolunteerNeedDto> Create(Guid organizationId, SaveVolunteerNeedRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, true, cancellationToken);
        AssertDates(request.StartDate, request.EndDate);
        await AssertRelations(organizationId, request.ProjectId, request.TaskCategoryId, request.DepartmentId, cancellationToken);
        var now = time.GetUtcNow().UtcDateTime;
        var need = new VolunteerNeed
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            CreatedByUserId = access.ActorUserId,
            PublicToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant(),
            Name = request.Name,
            Description = request.Description,
            Type = request.Type,
            CountNeeded = request.CountNeeded,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            RequiredBy = request.RequiredBy,
            AllowPublic = request.AllowPublic,
            RequireVetting = request.RequireVetting,
            Questions = request.Questions,
            ProjectId = request.ProjectId,
            TaskCategoryId = request.TaskCategoryId,
            DepartmentId = request.DepartmentId,
            Status = "published",
            CreatedAt = now,
            UpdatedAt = now,
        };
        db.VolunteerNeeds.Add(need);
        await db.SaveOrThrowAsync(cancellationToken);
        return VolunteerNeedDto.From(need);
    }

    public async Task<VolunteerNeedDto> Update(Guid needId, UpdateVolunteerNeedRequest request, CancellationToken cancellationToken)
    {
        var need = await Managed(needId, cancellationToken);
        if (request.Name.HasValue) need.Name = request.Name.Value;
        if (request.Description.HasValue) need.Description = request.Description.Value;
        if (request.Type.HasValue) need.Type = request.Type.Value;
        if (request.CountNeeded.HasValue)
        {
            if (request.CountNeeded.Value < need.CountVetted)
            {
                throw ApiException.Validation("countNeeded cannot be less than the number of vetted volunteers.");
            }

            need.CountNeeded = request.CountNeeded.Value;
        }

        if (request.StartDate.HasValue) need.StartDate = request.StartDate.Value;
        if (request.EndDate.HasValue) need.EndDate = request.EndDate.Value;
        if (request.RequiredBy.HasValue) need.RequiredBy = request.RequiredBy.Value;
        if (request.AllowPublic.HasValue) need.AllowPublic = request.AllowPublic.Value;
        if (request.RequireVetting.HasValue) need.RequireVetting = request.RequireVetting.Value;
        if (request.Questions.HasValue) need.Questions = request.Questions.Value;
        if (request.ProjectId.HasValue) need.ProjectId = request.ProjectId.Value;
        if (request.TaskCategoryId.HasValue) need.TaskCategoryId = request.TaskCategoryId.Value;
        if (request.DepartmentId.HasValue) need.DepartmentId = request.DepartmentId.Value;
        AssertDates(need.StartDate, need.EndDate);
        await AssertRelations(need.OrganizationId, need.ProjectId, need.TaskCategoryId, need.DepartmentId, cancellationToken);
        need.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveOrThrowAsync(cancellationToken);
        return VolunteerNeedDto.From(need);
    }

    public async Task Delete(Guid needId, CancellationToken cancellationToken)
    {
        db.VolunteerNeeds.Remove(await Managed(needId, cancellationToken));
        await db.SaveOrThrowAsync(cancellationToken);
    }

    public async Task<ListResponse<VolunteerSignupDto>> Signups(Guid needId, CancellationToken cancellationToken)
    {
        await Managed(needId, cancellationToken);
        var signups = await SignupQuery().Where(signup => signup.VolunteerNeedId == needId)
            .OrderByDescending(signup => signup.CreatedAt)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(signups.Select(VolunteerSignupDto.From).ToList(), new Page(signups.Count, 0));
    }

    public async Task<PublicVolunteerNeedDto> Public(string token, CancellationToken cancellationToken)
    {
        var need = await PublicNeed(token, cancellationToken);
        return PublicDto(need);
    }

    public async Task<VolunteerSignupDto> SignUp(string token, PublicSignupRequest request, CancellationToken cancellationToken)
    {
        if (!request.Acknowledged)
        {
            throw ApiException.Validation("Acknowledge how your email will be used.");
        }

        await captcha.Verify(request.CaptchaToken, cancellationToken);
        var user = current.UserOrNull;
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var need = await db.VolunteerNeeds.FirstOrDefaultAsync(item => item.PublicToken == token && item.AllowPublic && item.Status == "published", cancellationToken)
            ?? throw ApiException.NotFound();
        await db.LockVolunteerNeedAsync(need.Id, cancellationToken);
        await db.Entry(need).ReloadAsync(cancellationToken);
        RejectClosed(need);
        var (passed, answers) = NeedForms.Grade(need.Questions, request.Answers);
        var vetted = !need.RequireVetting && passed;
        if (vetted && need.CountVetted >= need.CountNeeded)
        {
            throw ApiException.Conflict("This need is already filled.");
        }

        VolunteerSignup signup;
        if (user is not null)
        {
            var guest = await db.Guests.FirstOrDefaultAsync(item => item.Email == user.Email, cancellationToken);
            if (guest is { UserId: null })
            {
                guest.UserId = user.Id;
            }

            if (await db.VolunteerSignups.AnyAsync(
                item => item.VolunteerNeedId == need.Id && (item.UserId == user.Id || (guest != null && item.GuestId == guest.Id)),
                cancellationToken))
            {
                throw ApiException.Conflict("You are already signed up for this need.");
            }

            signup = NewSignup(need, user.Id, null, request.Comment, answers, passed, vetted);
        }
        else
        {
            var email = Fields.NormalizeEmail(request.Email ?? "");
            if (await db.Users.AnyAsync(item => item.Email == email, cancellationToken))
            {
                throw new ApiException(409, "account_exists", "An account already uses this email. Log in to sign up.");
            }

            var guest = await db.Guests.FirstOrDefaultAsync(item => item.Email == email, cancellationToken);
            if (guest is null)
            {
                guest = new Guest
                {
                    Id = Guid.NewGuid(),
                    Name = NeedInput.GuestName(request.Name),
                    Email = email,
                    Phone = NeedInput.Phone(request.Phone),
                };
                db.Guests.Add(guest);
            }
            else
            {
                guest.Name = NeedInput.GuestName(request.Name);
                guest.Phone = NeedInput.Phone(request.Phone);
            }

            if (await db.VolunteerSignups.AnyAsync(item => item.VolunteerNeedId == need.Id && item.GuestId == guest.Id, cancellationToken))
            {
                throw ApiException.Conflict("You are already signed up for this need.");
            }

            signup = NewSignup(need, null, guest.Id, request.Comment, answers, passed, vetted);
        }

        if (vetted)
        {
            need.CountVetted += 1;
        }

        need.UpdatedAt = time.GetUtcNow().UtcDateTime;
        db.VolunteerSignups.Add(signup);
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return VolunteerSignupDto.From(await SignupQuery().FirstAsync(item => item.Id == signup.Id, cancellationToken));
    }

    public async Task<VolunteerSignupDto> Vet(Guid needId, Guid signupId, bool vetted, CancellationToken cancellationToken)
    {
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var need = await Managed(needId, cancellationToken);
        await db.LockVolunteerNeedAsync(need.Id, cancellationToken);
        await db.Entry(need).ReloadAsync(cancellationToken);
        var signup = await db.VolunteerSignups.FirstOrDefaultAsync(
            item => item.Id == signupId && item.VolunteerNeedId == need.Id, cancellationToken) ?? throw ApiException.NotFound();
        if (signup.Vetted != vetted)
        {
            if (vetted)
            {
                if (need.CountVetted >= need.CountNeeded)
                {
                    throw ApiException.Conflict("This need is already filled.");
                }

                need.CountVetted += 1;
            }
            else
            {
                need.CountVetted -= 1;
            }

            signup.Vetted = vetted;
            need.UpdatedAt = time.GetUtcNow().UtcDateTime;
            await db.SaveOrThrowAsync(cancellationToken);
        }

        await tx.CommitAsync(cancellationToken);
        return VolunteerSignupDto.From(await SignupQuery().FirstAsync(item => item.Id == signup.Id, cancellationToken));
    }

    public async Task DeleteSignup(Guid needId, Guid signupId, CancellationToken cancellationToken)
    {
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        var need = await Managed(needId, cancellationToken);
        await db.LockVolunteerNeedAsync(need.Id, cancellationToken);
        await db.Entry(need).ReloadAsync(cancellationToken);
        var signup = await db.VolunteerSignups.FirstOrDefaultAsync(
            item => item.Id == signupId && item.VolunteerNeedId == need.Id, cancellationToken) ?? throw ApiException.NotFound();
        if (signup.Vetted)
        {
            need.CountVetted -= 1;
        }

        db.VolunteerSignups.Remove(signup);
        need.UpdatedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveOrThrowAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
    }

    public async Task<EmailVolunteersResult> Email(Guid needId, EmailVolunteersRequest request, CancellationToken cancellationToken)
    {
        var need = await Managed(needId, cancellationToken);
        var ids = request.SignupIds.Distinct().ToArray();
        var signups = await SignupQuery().Where(signup => signup.VolunteerNeedId == need.Id && ids.Contains(signup.Id))
            .ToListAsync(cancellationToken);
        if (signups.Count != ids.Length)
        {
            throw ApiException.NotFound();
        }

        foreach (var signup in signups)
        {
            var person = VolunteerSignupDto.From(signup);
            await mail.Send(person.Email, need.OrganizationId, EmailTemplateFor.VolunteerMessage, new Dictionary<string, string?>
            {
                ["message.subject"] = request.Subject,
                ["message.body"] = request.Message,
                ["need.name"] = need.Name,
            }, cancellationToken);
        }

        return new EmailVolunteersResult(signups.Count);
    }

    IQueryable<VolunteerSignup> SignupQuery() =>
        db.VolunteerSignups.AsNoTracking()
            .Include(signup => signup.User)!.ThenInclude(user => user!.Profile)
            .Include(signup => signup.Guest);

    async Task<VolunteerNeed> Managed(Guid needId, CancellationToken cancellationToken)
    {
        var need = await db.VolunteerNeeds.FirstOrDefaultAsync(item => item.Id == needId, cancellationToken)
            ?? throw ApiException.NotFound();
        await access.RequireOrganization(need.OrganizationId, true, cancellationToken);
        return need;
    }

    async Task<VolunteerNeed> PublicNeed(string token, CancellationToken cancellationToken)
    {
        var need = await db.VolunteerNeeds.AsNoTracking()
            .Include(item => item.Organization)
            .FirstOrDefaultAsync(item => item.PublicToken == token && item.AllowPublic && item.Status == "published", cancellationToken);
        return need ?? throw ApiException.NotFound();
    }

    PublicVolunteerNeedDto PublicDto(VolunteerNeed need)
    {
        var closed = ClosedReason(need);
        return new PublicVolunteerNeedDto(
            need.Name,
            need.Description,
            need.Type.ToString(),
            need.CountNeeded,
            need.CountVetted,
            need.CountNeeded - need.CountVetted,
            need.StartDate,
            need.EndDate,
            need.RequiredBy,
            need.RequireVetting,
            closed,
            NeedForms.PublicQuestions(need.Questions),
            need.Organization.Name);
    }

    void RejectClosed(VolunteerNeed need)
    {
        var closed = ClosedReason(need);
        if (closed == "deadline")
        {
            throw ApiException.Conflict("Sign-up for this need has closed.");
        }

        if (closed == "full")
        {
            throw ApiException.Conflict("This need is already filled.");
        }
    }

    string? ClosedReason(VolunteerNeed need)
    {
        if (need.RequiredBy is DateTime deadline && deadline <= time.GetUtcNow().UtcDateTime)
        {
            return "deadline";
        }

        return need.CountVetted >= need.CountNeeded ? "full" : null;
    }

    VolunteerSignup NewSignup(VolunteerNeed need, Guid? userId, Guid? guestId, string? comment, string answers, bool passed, bool vetted) =>
        new()
        {
            Id = Guid.NewGuid(),
            VolunteerNeedId = need.Id,
            UserId = userId,
            GuestId = guestId,
            Comment = NeedInput.Comment(comment),
            Answers = answers,
            Passed = passed,
            Vetted = vetted,
            CreatedAt = time.GetUtcNow().UtcDateTime,
        };

    async Task AssertRelations(Guid organizationId, Guid? projectId, Guid? taskCategoryId, Guid? departmentId, CancellationToken cancellationToken)
    {
        if (projectId is Guid project && !await db.Projects.AnyAsync(item => item.Id == project && item.OrganizationId == organizationId, cancellationToken))
        {
            throw ApiException.Validation("projectId was not found.");
        }

        if (taskCategoryId is Guid category && !await db.TaskCategories.AnyAsync(item => item.Id == category && item.OrganizationId == organizationId, cancellationToken))
        {
            throw ApiException.Validation("taskCategoryId was not found.");
        }

        if (departmentId is Guid department && !await db.Departments.AnyAsync(item => item.Id == department && item.OrganizationId == organizationId, cancellationToken))
        {
            throw ApiException.Validation("departmentId was not found.");
        }
    }

    static IQueryable<VolunteerNeed> Filtered(IQueryable<VolunteerNeed> needs, VolunteerNeedQuery query)
    {
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var needle = query.Q.Trim();
            if (needle.Length > 200)
            {
                throw ApiException.Validation("q must be 200 characters or fewer.");
            }

            needs = needs.Where(need => EF.Functions.ILike(need.Name, "%" + needle + "%"));
        }

        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            var type = NeedInput.ParseType(query.Type);
            needs = needs.Where(need => need.Type == type);
        }

        if (!string.IsNullOrWhiteSpace(query.ProjectId))
        {
            if (!Guid.TryParse(query.ProjectId, out var projectId))
            {
                throw ApiException.Validation("projectId must be an id.");
            }

            needs = needs.Where(need => need.ProjectId == projectId);
        }

        if (!string.IsNullOrWhiteSpace(query.DepartmentId))
        {
            if (!Guid.TryParse(query.DepartmentId, out var departmentId))
            {
                throw ApiException.Validation("departmentId must be an id.");
            }

            needs = needs.Where(need => need.DepartmentId == departmentId);
        }

        if (!string.IsNullOrWhiteSpace(query.AllowPublic))
        {
            if (query.AllowPublic is not ("true" or "false"))
            {
                throw ApiException.Validation("allowPublic must be true or false.");
            }

            var allowPublic = query.AllowPublic == "true";
            needs = needs.Where(need => need.AllowPublic == allowPublic);
        }

        return needs;
    }

    static IQueryable<VolunteerNeed> Ordered(IQueryable<VolunteerNeed> needs, string? sort, string? order)
    {
        var descending = order == "desc";
        if (order is not (null or "" or "asc" or "desc"))
        {
            throw ApiException.Validation("order must be asc or desc.");
        }

        return (string.IsNullOrWhiteSpace(sort) ? "name" : sort) switch
        {
            "name" => descending ? needs.OrderByDescending(need => need.Name) : needs.OrderBy(need => need.Name),
            "type" => descending ? needs.OrderByDescending(need => need.Type) : needs.OrderBy(need => need.Type),
            "startDate" => descending ? needs.OrderByDescending(need => need.StartDate) : needs.OrderBy(need => need.StartDate),
            "endDate" => descending ? needs.OrderByDescending(need => need.EndDate) : needs.OrderBy(need => need.EndDate),
            "countNeeded" => descending ? needs.OrderByDescending(need => need.CountNeeded) : needs.OrderBy(need => need.CountNeeded),
            "countVetted" => descending ? needs.OrderByDescending(need => need.CountVetted) : needs.OrderBy(need => need.CountVetted),
            "createdAt" => descending ? needs.OrderByDescending(need => need.CreatedAt) : needs.OrderBy(need => need.CreatedAt),
            _ => throw ApiException.Validation("sort must be name, type, startDate, endDate, countNeeded, countVetted, or createdAt."),
        };
    }

    static void AssertDates(DateOnly? startDate, DateOnly? endDate)
    {
        if (startDate is DateOnly start && endDate is DateOnly end && end < start)
        {
            throw ApiException.Validation("endDate must be on or after startDate.");
        }
    }

}

static class NeedInput
{
    public static string? Description(JsonObject body, bool required)
    {
        if (!required && !Fields.Has(body, "description"))
        {
            return null;
        }

        var value = Fields.OptionalString(body, "description");
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length == 0)
        {
            return null;
        }

        if (trimmed.Length > 4000)
        {
            throw ApiException.Validation("description must be 4000 characters or fewer.");
        }

        return trimmed;
    }

    public static string? Comment(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > 2000)
        {
            throw ApiException.Validation("comment must be 2000 characters or fewer.");
        }

        return trimmed;
    }

    public static string GuestName(string? value)
    {
        var trimmed = value?.Trim() ?? "";
        if (trimmed.Length is < 1 or > 120)
        {
            throw ApiException.Validation("name is required.");
        }

        return trimmed;
    }

    public static string Phone(string? value)
    {
        var trimmed = value?.Trim() ?? "";
        if (trimmed.Length is < 1 or > 40)
        {
            throw ApiException.Validation("phone is required.");
        }

        return trimmed;
    }

    public static VolunteerNeedType ParseType(string value) => value switch
    {
        "Position" => VolunteerNeedType.Position,
        "Task" => VolunteerNeedType.Task,
        _ => throw ApiException.Validation("type must be Position or Task."),
    };

    public static int Count(int value)
    {
        if (value is < 1 or > 10000)
        {
            throw ApiException.Validation("countNeeded must be from 1 to 10000.");
        }

        return value;
    }
}

public static class VolunteerNeedsEndpoints
{
    public static void MapVolunteerNeedsEndpoints(this IEndpointRouteBuilder app)
    {
        var byOrganization = app.MapGroup("/organizations/{id:guid}/volunteer-needs").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<VolunteerNeedDto>>> (
            Guid id, [AsParameters] VolunteerNeedQuery query, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        byOrganization.MapPost("", async Task<Created<VolunteerNeedDto>> (
            Guid id, SaveVolunteerNeedRequest request, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var needs = app.MapGroup("/volunteer-needs").RequireAuthorization();
        needs.MapGet("/{id:guid}", async Task<Ok<VolunteerNeedDto>> (Guid id, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        needs.MapPatch("/{id:guid}", async Task<Ok<VolunteerNeedDto>> (
            Guid id, UpdateVolunteerNeedRequest request, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        needs.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, VolunteerNeedsService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
        needs.MapGet("/{id:guid}/signups", async Task<Ok<ListResponse<VolunteerSignupDto>>> (
            Guid id, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Signups(id, ct)));
        needs.MapPost("/{id:guid}/signups/{signupId:guid}/vet", async Task<Ok<VolunteerSignupDto>> (
            Guid id, Guid signupId, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Vet(id, signupId, true, ct)));
        needs.MapPost("/{id:guid}/signups/{signupId:guid}/unvet", async Task<Ok<VolunteerSignupDto>> (
            Guid id, Guid signupId, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Vet(id, signupId, false, ct)));
        needs.MapDelete("/{id:guid}/signups/{signupId:guid}", async Task<NoContent> (
            Guid id, Guid signupId, VolunteerNeedsService service, CancellationToken ct) =>
        {
            await service.DeleteSignup(id, signupId, ct);
            return TypedResults.NoContent();
        });
        needs.MapPost("/{id:guid}/emails", async Task<Ok<EmailVolunteersResult>> (
            Guid id, EmailVolunteersRequest request, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Email(id, request, ct)));

        var open = app.MapGroup("/volunteer-needs/public");
        open.MapGet("/{token}", async Task<Ok<PublicVolunteerNeedDto>> (string token, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Public(token, ct)));
        open.MapPost("/{token}/signups", async Task<Created<VolunteerSignupDto>> (
            string token, PublicSignupRequest request, VolunteerNeedsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.SignUp(token, request, ct)));
    }
}
