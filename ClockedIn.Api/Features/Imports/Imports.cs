using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Features.VolunteerNeeds;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Imports;

public sealed record ImportErrorDto(int Row, string Message);

public sealed record ImportedPasswordDto(string Email, string Username, string TemporaryPassword);

public sealed record PeopleImportResult(
    int Created,
    int Skipped,
    IReadOnlyList<ImportErrorDto> Errors,
    IReadOnlyList<ImportedPasswordDto> Passwords);

public sealed record ImportResult(int Created, int Skipped, IReadOnlyList<ImportErrorDto> Errors);

public sealed class ImportRequest
{
    private ImportRequest(IReadOnlyList<JsonNode?> rows) => Rows = rows;

    public IReadOnlyList<JsonNode?> Rows { get; }

    public static async ValueTask<ImportRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        if (!Fields.Has(body, "rows") || body["rows"] is not JsonArray array)
        {
            throw ApiException.Validation("rows must be an array.");
        }

        if (array.Count > 1000)
        {
            throw ApiException.Validation("A CSV import can include at most 1000 rows.");
        }

        var rows = new List<JsonNode?>();
        foreach (var item in array)
        {
            rows.Add(item);
        }

        return new ImportRequest(rows);
    }
}

public sealed class ImportsService(ClockedInDbContext db, Access access, TimeProvider time)
{
    private static readonly Regex UsernamePattern = new(@"^[a-z0-9][a-z0-9._-]{2,49}$", RegexOptions.Compiled);

    private sealed record RowOutcome(bool Skip, string? Email, string? Username, string? Key, ImportedPasswordDto? Password);

    private sealed class Totals
    {
        public int Created { get; set; }
        public int Skipped { get; set; }
        public List<ImportErrorDto> Errors { get; } = [];
        public List<ImportedPasswordDto> Passwords { get; } = [];
    }

    public async Task<PeopleImportResult> People(Guid organizationId, ImportRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var rateType = await db.Organizations.Where(item => item.Id == organizationId)
            .Select(item => item.DefaultRateType)
            .FirstAsync(cancellationToken);
        var seenEmails = new HashSet<string>(StringComparer.Ordinal);
        var seenUsernames = new HashSet<string>(StringComparer.Ordinal);
        var totals = await EachRow(organizationId, request, async (row, rowCancellation) =>
        {
            var email = Fields.NormalizeEmail(Required(row, "email"));
            if (seenEmails.Contains(email) || await db.Users.AnyAsync(user => user.Email == email, rowCancellation))
            {
                return new RowOutcome(true, email, null, null, null);
            }

            var firstName = Fields.PersonName(Required(row, "firstName"), "firstName");
            var lastName = Fields.PersonName(Required(row, "lastName"), "lastName");
            var displayName = Limited(Text(row, "displayName"), 100, "displayName is required.");
            var timezone = Text(row, "timezone") ?? "UTC";
            Fields.AssertTimezone(timezone);
            var phone = Limited(Text(row, "phone"), 40, "phone is required.");
            var zipCode = Limited(Text(row, "zipCode"), 20, "zipCode must be 20 characters or fewer.");
            var notes = Limited(Text(row, "notes"), 2000, "notes must be 2000 characters or fewer.");
            var memberNumber = Limited(Text(row, "memberNumber"), 100, "memberNumber must be 100 characters or fewer.");
            var roleText = Text(row, "role");
            var role = roleText is null ? RoleCode.VOLUNTEER : Fields.NormalizeRole(roleText);
            var departmentName = Text(row, "primaryDepartment");
            Department? department = null;
            if (departmentName is not null)
            {
                var name = Fields.RequireName(departmentName, "primaryDepartment");
                department = await DepartmentByName(organizationId, name, rowCancellation)
                    ?? throw ApiException.Validation("primaryDepartment was not found.");
            }

            var username = await AllocateUsername(email, Text(row, "username"), seenUsernames, rowCancellation);
            var password = TemporaryPassword();
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = email,
                PasswordHash = Passwords.Hash(password),
                MustChangePassword = true,
                Profile = new UserProfile
                {
                    Id = Guid.NewGuid(),
                    FirstName = firstName,
                    LastName = lastName,
                    DisplayName = displayName,
                    Timezone = timezone,
                    Phone = phone,
                    ZipCode = zipCode,
                    Notes = notes,
                    MemberNumber = memberNumber,
                },
            };
            user.Profile.UserId = user.Id;
            db.Users.Add(user);
            await GuestLinks.Attach(db, user.Email, user.Id, rowCancellation);
            db.OrganizationMemberships.Add(new OrganizationMembership
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                OrganizationId = organizationId,
                RoleId = Role.IdOf(role),
                RateType = rateType,
                IsActive = true,
                JoinedAt = time.GetUtcNow().UtcDateTime,
                PrimaryDepartmentId = department?.Id,
            });
            if (department is not null)
            {
                db.DepartmentMemberships.Add(new DepartmentMembership
                {
                    Id = Guid.NewGuid(),
                    UserId = user.Id,
                    DepartmentId = department.Id,
                    RoleId = Role.MemberId,
                    JoinedAt = time.GetUtcNow().UtcDateTime,
                });
            }

            return new RowOutcome(false, email, username, null, new ImportedPasswordDto(email, username, password));
        }, (outcome) =>
        {
            if (outcome.Email is not null)
            {
                seenEmails.Add(outcome.Email);
            }

            if (outcome.Username is not null)
            {
                seenUsernames.Add(outcome.Username);
            }
        }, cancellationToken);

        return new PeopleImportResult(totals.Created, totals.Skipped, totals.Errors, totals.Passwords);
    }

    public async Task<ImportResult> Departments(Guid organizationId, ImportRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var totals = await EachRow(organizationId, request, async (row, rowCancellation) =>
        {
            var name = Fields.RequireName(Required(row, "name"));
            if (seen.Contains(name) || await DepartmentByName(organizationId, name, rowCancellation) is not null)
            {
                return new RowOutcome(true, null, null, name, null);
            }

            db.Departments.Add(new Department { Id = Guid.NewGuid(), OrganizationId = organizationId, Name = name });
            return new RowOutcome(false, null, null, name, null);
        }, (outcome) =>
        {
            if (outcome.Key is not null)
            {
                seen.Add(outcome.Key);
            }
        }, cancellationToken);
        return new ImportResult(totals.Created, totals.Skipped, totals.Errors);
    }

    public async Task<ImportResult> Projects(Guid organizationId, ImportRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var ownerUserId = access.ActorUserId;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var totals = await EachRow(organizationId, request, async (row, rowCancellation) =>
        {
            var title = Fields.RequireName(Required(row, "title"), "title");
            if (seen.Contains(title) || await db.Projects.AnyAsync(
                item => item.OrganizationId == organizationId && item.Title == title,
                rowCancellation))
            {
                return new RowOutcome(true, null, null, title, null);
            }

            var accessText = Text(row, "accessType");
            var accessType = accessText is null ? AccessType.Public : Fields.NormalizeAccessType(EnumWord(accessText));
            var typeText = Text(row, "projectType");
            var projectType = typeText is null ? ProjectType.Project : Fields.NormalizeProjectType(EnumWord(typeText));
            var departmentName = Text(row, "department");
            if (accessType == AccessType.Department && departmentName is null)
            {
                throw ApiException.Validation("department is required when accessType is Department.");
            }

            if (accessType != AccessType.Department && departmentName is not null)
            {
                throw ApiException.Validation("department must be empty when accessType is Public or Private.");
            }

            Guid? departmentId = null;
            if (departmentName is not null)
            {
                var name = Fields.RequireName(departmentName, "department");
                departmentId = (await DepartmentByName(organizationId, name, rowCancellation)
                    ?? throw ApiException.Validation("department was not found.")).Id;
            }

            var startText = Text(row, "startDate");
            var endText = Text(row, "endDate");
            var startDate = startText is null ? (DateOnly?)null : ImportDate(startText, "startDate");
            var endDate = endText is null ? (DateOnly?)null : ImportDate(endText, "endDate");
            if (startDate is DateOnly start && endDate is DateOnly end && end < start)
            {
                throw ApiException.Validation("endDate must be on or after startDate.");
            }

            var activeText = Text(row, "isActive");
            db.Projects.Add(new Project
            {
                Id = Guid.NewGuid(),
                OrganizationId = organizationId,
                DepartmentId = departmentId,
                OwnerUserId = ownerUserId,
                Title = title,
                Description = Fields.Description(Text(row, "description")),
                AccessType = accessType,
                ProjectType = projectType,
                StartDate = startDate,
                EndDate = endDate,
                IsActive = activeText is null || ImportBool(activeText, "isActive"),
            });
            return new RowOutcome(false, null, null, title, null);
        }, (outcome) =>
        {
            if (outcome.Key is not null)
            {
                seen.Add(outcome.Key);
            }
        }, cancellationToken);
        return new ImportResult(totals.Created, totals.Skipped, totals.Errors);
    }

    private async Task<Totals> EachRow(
        Guid organizationId,
        ImportRequest request,
        Func<JsonObject, CancellationToken, Task<RowOutcome>> importRow,
        Action<RowOutcome> remember,
        CancellationToken cancellationToken)
    {
        var totals = new Totals();
        for (var index = 0; index < request.Rows.Count; index += 1)
        {
            var rowNumber = index + 1;
            if (request.Rows[index] is not JsonObject row)
            {
                totals.Errors.Add(new ImportErrorDto(rowNumber, "Each row must be an object."));
                continue;
            }

            if (IsBlank(row))
            {
                continue;
            }

            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                await db.LockOrganizationAsync(organizationId, cancellationToken);
                var outcome = await importRow(row, cancellationToken);
                if (outcome.Skip)
                {
                    await tx.RollbackAsync(cancellationToken);
                    db.ChangeTracker.Clear();
                    totals.Skipped += 1;
                }
                else
                {
                    await db.SaveOrThrowAsync(cancellationToken);
                    await tx.CommitAsync(cancellationToken);
                    db.ChangeTracker.Clear();
                    totals.Created += 1;
                    if (outcome.Password is not null)
                    {
                        totals.Passwords.Add(outcome.Password);
                    }
                }

                remember(outcome);
            }
            catch (Exception exception)
            {
                db.ChangeTracker.Clear();
                try
                {
                    await tx.RollbackAsync(cancellationToken);
                }
                catch (Exception)
                {
                    // The transaction may already be aborted by the failed save.
                }

                if (exception is ApiException api && api.Status is 400 or 409)
                {
                    totals.Errors.Add(new ImportErrorDto(rowNumber, api.Message));
                    continue;
                }

                throw;
            }
        }

        return totals;
    }

    private Task<Department?> DepartmentByName(Guid organizationId, string name, CancellationToken cancellationToken) =>
        db.Departments.FirstOrDefaultAsync(
            item => item.OrganizationId == organizationId && item.Name == name,
            cancellationToken);

    private async Task<string> AllocateUsername(string email, string? requested, HashSet<string> seen, CancellationToken cancellationToken)
    {
        if (requested is not null)
        {
            var username = Fields.NormalizeUsername(requested);
            if (seen.Contains(username) || await db.Users.AnyAsync(user => user.Username == username, cancellationToken))
            {
                throw ApiException.Validation("username is already in use.");
            }

            return username;
        }

        var baseName = UsernameFromEmail(email);
        var suffix = "";
        for (var attempt = 0; attempt < 1000; attempt += 1)
        {
            var username = baseName[..Math.Min(baseName.Length, 50 - suffix.Length)] + suffix;
            if (!seen.Contains(username) && !await db.Users.AnyAsync(user => user.Username == username, cancellationToken))
            {
                return username;
            }

            suffix = (attempt + 2).ToString(CultureInfo.InvariantCulture);
        }

        throw ApiException.Validation("username is already in use.");
    }

    private static string UsernameFromEmail(string email)
    {
        var local = email.Split('@')[0];
        var cleaned = Regex.Replace(local.ToLowerInvariant(), "[^a-z0-9._-]", "");
        cleaned = Regex.Replace(cleaned, "^[._-]+", "");
        if (cleaned.Length == 0 || !char.IsAsciiLetterOrDigit(cleaned[0]))
        {
            cleaned = "u" + cleaned;
        }

        if (cleaned.Length < 3)
        {
            var padded = cleaned + "user";
            cleaned = padded[..Math.Min(50, padded.Length)];
        }

        if (cleaned.Length > 50)
        {
            cleaned = cleaned[..50];
        }

        return UsernamePattern.IsMatch(cleaned) ? cleaned : "user";
    }

    private static string TemporaryPassword() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(18)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static bool IsBlank(JsonObject row)
    {
        foreach (var property in row)
        {
            if (property.Value is null)
            {
                continue;
            }

            if (property.Value is JsonValue value && value.TryGetValue<string>(out var text) && string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            return false;
        }

        return true;
    }

    private static string? Text(JsonObject row, string key)
    {
        if (!row.ContainsKey(key) || row[key] is null)
        {
            return null;
        }

        if (row[key] is not JsonValue value)
        {
            throw ApiException.Validation($"{key} must be text.");
        }

        if (value.TryGetValue<string>(out var text))
        {
            var trimmed = text.Trim();
            return trimmed.Length == 0 ? null : trimmed;
        }

        if (value.TryGetValue<bool>(out var flag))
        {
            return flag ? "true" : "false";
        }

        if (value.TryGetValue<int>(out var number))
        {
            return number.ToString(CultureInfo.InvariantCulture);
        }

        if (value.TryGetValue<long>(out var longNumber))
        {
            return longNumber.ToString(CultureInfo.InvariantCulture);
        }

        if (value.TryGetValue<double>(out var real))
        {
            return real.ToString(CultureInfo.InvariantCulture);
        }

        throw ApiException.Validation($"{key} must be text.");
    }

    private static string Required(JsonObject row, string key) =>
        Text(row, key) ?? throw ApiException.Validation($"{key} is required.");

    private static string? Limited(string? value, int max, string message)
    {
        if (value is not null && value.Length > max)
        {
            throw ApiException.Validation(message);
        }

        return value;
    }

    private static string EnumWord(string value)
    {
        var lower = value.Trim().ToLowerInvariant();
        return lower.Length == 0 ? lower : char.ToUpperInvariant(lower[0]) + lower[1..];
    }

    private static bool ImportBool(string value, string key)
    {
        switch (value.Trim().ToLowerInvariant())
        {
            case "true":
            case "yes":
            case "y":
            case "1":
                return true;
            case "false":
            case "no":
            case "n":
            case "0":
                return false;
            default:
                throw ApiException.Validation($"{key} must be a boolean.");
        }
    }

    private static DateOnly ImportDate(string value, string key)
    {
        if (DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso))
        {
            return iso;
        }

        if (DateOnly.TryParseExact(value, "M/d/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var unitedStates))
        {
            return unitedStates;
        }

        var shortYear = Regex.Match(value, @"^(\d{1,2})/(\d{1,2})/(\d{2})$");
        if (shortYear.Success
            && DateOnly.TryParseExact(
                $"20{shortYear.Groups[3].Value}-{int.Parse(shortYear.Groups[1].Value, CultureInfo.InvariantCulture):00}-{int.Parse(shortYear.Groups[2].Value, CultureInfo.InvariantCulture):00}",
                "yyyy-MM-dd",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var expanded))
        {
            return expanded;
        }

        throw ApiException.Validation($"{key} must be a date.");
    }
}

public static class ImportsEndpoints
{
    public static void MapImportsEndpoints(this IEndpointRouteBuilder app)
    {
        var imports = app.MapGroup("/organizations/{id:guid}/imports").RequireAuthorization();
        imports.MapPost("/people", async Task<Ok<PeopleImportResult>> (Guid id, ImportRequest request, ImportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.People(id, request, ct)));
        imports.MapPost("/departments", async Task<Ok<ImportResult>> (Guid id, ImportRequest request, ImportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Departments(id, request, ct)));
        imports.MapPost("/projects", async Task<Ok<ImportResult>> (Guid id, ImportRequest request, ImportsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Projects(id, request, ct)));
    }
}
