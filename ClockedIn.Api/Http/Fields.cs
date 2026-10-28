using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ClockedIn.Api.Entities;

namespace ClockedIn.Api.Http;

public static class Fields
{
    private static readonly Regex EmailPattern = new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.Compiled);
    private static readonly Regex UsernamePattern = new(@"^[a-z0-9][a-z0-9._-]{2,49}$", RegexOptions.Compiled);

    public static Page Page(string? limitText, string? offsetText)
    {
        var limit = ParseOptionalInt(limitText, 50, "limit must be from 1 to 100.");
        var offset = ParseOptionalInt(offsetText, 0, "offset must be zero or greater.");
        if (limit < 1 || limit > 100)
        {
            throw ApiException.Validation("limit must be from 1 to 100.");
        }

        if (offset < 0)
        {
            throw ApiException.Validation("offset must be zero or greater.");
        }

        return new Page(limit, offset);
    }

    public static bool Has(JsonObject body, string key) => body.ContainsKey(key);

    public static string? OptionalString(JsonObject body, string key)
    {
        if (!Has(body, key))
        {
            return null;
        }

        return ReadString(body, key);
    }

    public static string RequiredString(JsonObject body, string key)
    {
        if (!Has(body, key))
        {
            throw ApiException.Validation($"{key} is required.");
        }

        var value = ReadString(body, key);
        if (string.IsNullOrEmpty(value))
        {
            throw ApiException.Validation($"{key} is required.");
        }

        return value;
    }

    public static Guid RequiredGuid(JsonObject body, string key)
    {
        if (!Guid.TryParse(RequiredString(body, key), out var id))
        {
            throw ApiException.Validation($"{key} must be an id.");
        }

        return id;
    }

    public static Guid? OptionalGuid(JsonObject body, string key)
    {
        if (!Has(body, key) || body[key] is null)
        {
            return null;
        }

        if (!Guid.TryParse(RequiredString(body, key), out var id))
        {
            throw ApiException.Validation($"{key} must be an id.");
        }

        return id;
    }

    public static int RequiredInt(JsonObject body, string key)
    {
        if (body[key] is JsonValue value && value.TryGetValue<int>(out var number))
        {
            return number;
        }

        throw ApiException.Validation($"{key} must be an integer.");
    }

    public static bool RequiredBool(JsonObject body, string key)
    {
        if (body[key] is JsonValue value && value.TryGetValue<bool>(out var flag))
        {
            return flag;
        }

        throw ApiException.Validation($"{key} must be a boolean.");
    }

    public static decimal RequiredDecimal(JsonObject body, string key)
    {
        if (body[key] is JsonValue value)
        {
            if (value.TryGetValue<decimal>(out var decimalValue))
            {
                return decimalValue;
            }

            if (value.TryGetValue<double>(out var doubleValue))
            {
                return (decimal)doubleValue;
            }

            if (value.TryGetValue<int>(out var intValue))
            {
                return intValue;
            }

            if (value.TryGetValue<long>(out var longValue))
            {
                return longValue;
            }

            if (value.TryGetValue<string>(out var text)
                && decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }
        }

        throw ApiException.Validation($"{key} must be a number.");
    }

    public static decimal? OptionalDecimal(JsonObject body, string key)
    {
        if (!Has(body, key) || body[key] is null)
        {
            return null;
        }

        return RequiredDecimal(body, key);
    }

    public static DateOnly? OptionalDate(JsonObject body, string key)
    {
        if (!Has(body, key) || body[key] is null)
        {
            return null;
        }

        return RequiredDate(body, key);
    }

    public static RateType NormalizeRateType(string value) =>
        value.Trim() switch
        {
            "Volunteer" => RateType.Volunteer,
            "Professional" => RateType.Professional,
            _ => throw ApiException.Validation("rateType must be Volunteer or Professional."),
        };

    public static ProjectType NormalizeProjectType(string value) =>
        value.Trim() switch
        {
            "Project" => ProjectType.Project,
            "Event" => ProjectType.Event,
            _ => throw ApiException.Validation("projectType must be Project or Event."),
        };

    public static AccessType NormalizeAccessType(string value) =>
        value.Trim() switch
        {
            "Public" => AccessType.Public,
            "Private" => AccessType.Private,
            "Department" => AccessType.Department,
            _ => throw ApiException.Validation("accessType must be Public, Private, or Department."),
        };

    public static FeedbackType NormalizeFeedbackType(string value) =>
        value.Trim() switch
        {
            "Bug" => FeedbackType.Bug,
            "Feature" => FeedbackType.Feature,
            _ => throw ApiException.Validation("type must be Bug or Feature."),
        };

    public static FeedbackPriority NormalizeFeedbackPriority(string value) =>
        value.Trim() switch
        {
            "Urgent" => FeedbackPriority.Urgent,
            "High" => FeedbackPriority.High,
            "Medium" => FeedbackPriority.Medium,
            "Low" => FeedbackPriority.Low,
            _ => throw ApiException.Validation("priority must be Urgent, High, Medium, or Low."),
        };

    public static FeedbackArea NormalizeFeedbackArea(string value) =>
        value.Trim() switch
        {
            "Dashboard" => FeedbackArea.Dashboard,
            "LogTime" => FeedbackArea.LogTime,
            "Entries" => FeedbackArea.Entries,
            "Reports" => FeedbackArea.Reports,
            "Settings" => FeedbackArea.Settings,
            "Other" => FeedbackArea.Other,
            _ => throw ApiException.Validation("area must be Dashboard, LogTime, Entries, Reports, Settings, or Other."),
        };

    public static FeedbackStatus NormalizeFeedbackStatus(string value) =>
        value.Trim() switch
        {
            "Pending" => FeedbackStatus.Pending,
            "Acknowledged" => FeedbackStatus.Acknowledged,
            "Planned" => FeedbackStatus.Planned,
            "InProgress" => FeedbackStatus.InProgress,
            "Resolved" => FeedbackStatus.Resolved,
            "Cancelled" => FeedbackStatus.Cancelled,
            "CouldNotReproduce" => FeedbackStatus.CouldNotReproduce,
            "Archived" => FeedbackStatus.Archived,
            _ => throw ApiException.Validation("status must be Pending, Acknowledged, Planned, InProgress, Resolved, Cancelled, CouldNotReproduce, or Archived."),
        };

    public static string FeedbackTitle(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length is < 1 or > 120)
        {
            throw ApiException.Validation("title must be 1 to 120 characters.");
        }

        return trimmed;
    }

    public static string RequiredLongText(JsonObject body, string key, int max)
    {
        var trimmed = RequiredString(body, key).Trim();
        if (trimmed.Length < 1 || trimmed.Length > max)
        {
            throw ApiException.Validation($"{key} must be 1 to {max} characters.");
        }

        return trimmed;
    }

    public static List<string> ScreenshotUrls(JsonObject body)
    {
        if (!Has(body, "screenshotUrls"))
        {
            return [];
        }

        if (body["screenshotUrls"] is not JsonArray array)
        {
            throw ApiException.Validation("screenshotUrls must be an array of URLs.");
        }

        if (array.Count > 5)
        {
            throw ApiException.Validation("screenshotUrls must have 5 or fewer URLs.");
        }

        var urls = new List<string>();
        foreach (var item in array)
        {
            if (item is not JsonValue value || !value.TryGetValue<string>(out var text))
            {
                throw ApiException.Validation("screenshotUrls must be an array of URLs.");
            }

            var url = text.Trim();
            if (url.Length is < 1 or > 2000)
            {
                throw ApiException.Validation("screenshotUrls must be an array of URLs.");
            }

            urls.Add(url);
        }

        return urls;
    }

    public static string? TicketUrl(JsonObject body)
    {
        if (!Has(body, "ticketUrl") || body["ticketUrl"] is null)
        {
            return null;
        }

        var value = RequiredString(body, "ticketUrl").Trim();
        if (value.Length == 0)
        {
            return null;
        }

        if (value.Length > 2000
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw ApiException.Validation("ticketUrl must be a URL.");
        }

        return value;
    }

    public static bool? QueryBool(string? text, string key)
    {
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        return text switch
        {
            "true" => true,
            "false" => false,
            _ => throw ApiException.Validation($"{key} must be true or false."),
        };
    }

    public static RoleCode NormalizeRole(string value) =>
        value.Trim().ToUpperInvariant() switch
        {
            "MEMBER" => RoleCode.MEMBER,
            "VOLUNTEER" => RoleCode.VOLUNTEER,
            "ADMIN" => RoleCode.ADMIN,
            _ => throw ApiException.Validation("role must be MEMBER, VOLUNTEER, or ADMIN."),
        };

    public static decimal RoundMoney(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static decimal InKindFromMinutes(int durationMinutes, decimal hourlyRate) =>
        RoundMoney(durationMinutes * hourlyRate / 60m);

    public static decimal CollectiveInKind(DateTime startedAt, DateTime endedAt, int participantCount, decimal hourlyRate)
    {
        var ticks = (decimal)(endedAt - startedAt).Ticks;
        return RoundMoney(ticks * participantCount * hourlyRate / TimeSpan.TicksPerHour);
    }

    public static void AssertDurationMinutes(int durationMinutes)
    {
        if (durationMinutes is < 1 or > 1440)
        {
            throw ApiException.Validation("durationMinutes must be from 1 to 1440.");
        }
    }

    public static void AssertTotalMinutes(int durationMinutes)
    {
        if (durationMinutes is < 1 or > 59940)
        {
            throw ApiException.Validation("durationMinutes must be from 1 to 59940.");
        }
    }

    public static List<Guid> Ids(JsonObject body, string key, bool optional)
    {
        if (!Has(body, key))
        {
            if (optional)
            {
                return [];
            }

            throw ApiException.Validation($"{key} must be an array of ids.");
        }

        if (body[key] is not JsonArray array)
        {
            throw ApiException.Validation($"{key} must be an array of ids.");
        }

        var ids = new List<Guid>();
        foreach (var item in array)
        {
            if (item is not JsonValue value || !value.TryGetValue<string>(out var text) || !Guid.TryParse(text, out var id))
            {
                throw ApiException.Validation($"{key} must be an array of ids.");
            }

            ids.Add(id);
        }

        return ids;
    }

    public static DateTime RequiredInstant(JsonObject body, string key)
    {
        if (!Has(body, key))
        {
            throw ApiException.Validation($"{key} is required.");
        }

        return ParseInstant(RequiredString(body, key), key);
    }

    public static DateTime? OptionalInstant(JsonObject body, string key)
    {
        if (!Has(body, key) || body[key] is null)
        {
            return null;
        }

        return ParseInstant(RequiredString(body, key), key);
    }

    public static DateOnly RequiredDate(JsonObject body, string key)
    {
        if (!DateOnly.TryParseExact(RequiredString(body, key), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            throw ApiException.Validation($"{key} must be a date.");
        }

        return date;
    }

    public static Guid? QueryGuid(string? text, string key)
    {
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        if (!Guid.TryParse(text, out var id))
        {
            throw ApiException.Validation($"{key} must be an id.");
        }

        return id;
    }

    public static IReadOnlyList<Guid>? QueryGuids(string? text, string key)
    {
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        var ids = new List<Guid>();
        foreach (var part in text.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Guid.TryParse(part, out var id))
            {
                throw ApiException.Validation($"{key} must be an id.");
            }

            if (!ids.Contains(id))
            {
                ids.Add(id);
            }
        }

        return ids.Count == 0 ? null : ids;
    }

    public static DateOnly? QueryDate(string? text, string key)
    {
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            throw ApiException.Validation($"{key} must be a date.");
        }

        return date;
    }

    public static string NormalizeEmail(string value)
    {
        var email = value.Trim().ToLowerInvariant();
        if (email.Length > 254 || !EmailPattern.IsMatch(email))
        {
            throw ApiException.Validation("email must be an email address.");
        }

        return email;
    }

    public static string NormalizeUsername(string value)
    {
        var username = value.Trim().ToLowerInvariant();
        if (!UsernamePattern.IsMatch(username))
        {
            throw ApiException.Validation("username must be 3 to 50 characters and use lowercase letters, numbers, dots, underscores, or hyphens.");
        }

        return username;
    }

    public static string NormalizePassword(string value)
    {
        if (value.Length < 8 || value.Length > 200)
        {
            throw ApiException.Validation("password must be 8 to 200 characters.");
        }

        return value;
    }

    public static string PersonName(string value, string key)
    {
        var trimmed = value.Trim();
        if (trimmed.Length is < 1 or > 100)
        {
            throw ApiException.Validation($"{key} is required.");
        }

        return trimmed;
    }

    public static string RequireName(string value, string key = "name")
    {
        var trimmed = value.Trim();
        if (trimmed.Length is < 1 or > 200)
        {
            throw ApiException.Validation($"{key} is required.");
        }

        return trimmed;
    }

    public static string? CleanOptional(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    public static string? Description(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var trimmed = value.Trim();
        if (trimmed.Length > 2000)
        {
            throw ApiException.Validation("description must be 2000 characters or fewer.");
        }

        return trimmed.Length == 0 ? null : trimmed;
    }

    public static string? OptionalDescription(JsonObject body) =>
        Has(body, "description") ? Description(OptionalString(body, "description")) : null;

    public static string? SourceRef(JsonObject body)
    {
        if (!Has(body, "sourceRef") || body["sourceRef"] is null)
        {
            return null;
        }

        var value = RequiredString(body, "sourceRef").Trim();
        if (value.Length is < 1 or > 200)
        {
            throw ApiException.Validation("sourceRef must be 1 to 200 characters.");
        }

        return value;
    }

    public static int WholeMinutes(DateTime startedAt, DateTime endedAt) =>
        (int)Math.Floor((endedAt - startedAt).TotalSeconds / 60.0);

    public static DateOnly LocalDate(DateTime utc, string timeZone)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), FindZone(timeZone));
        return DateOnly.FromDateTime(local);
    }

    public static void AssertTimezone(string timeZone) => FindZone(timeZone);

    private static TimeZoneInfo FindZone(string timeZone)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        }
        catch (TimeZoneNotFoundException)
        {
            throw ApiException.Validation("timezone must be an IANA name.");
        }
        catch (InvalidTimeZoneException)
        {
            throw ApiException.Validation("timezone must be an IANA name.");
        }
    }

    private static string? ReadString(JsonObject body, string key)
    {
        if (body[key] is null)
        {
            return null;
        }

        if (body[key] is JsonValue value && value.TryGetValue<string>(out var text))
        {
            return text;
        }

        throw ApiException.Validation($"{key} must be a string.");
    }

    private static DateTime ParseInstant(string text, string key)
    {
        if (!DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed))
        {
            throw ApiException.Validation($"{key} must be a date-time.");
        }

        var utc = parsed.UtcDateTime;
        return new DateTime(utc.Ticks - utc.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
    }

    private static int ParseOptionalInt(string? text, int fallback, string message)
    {
        if (string.IsNullOrEmpty(text))
        {
            return fallback;
        }

        if (!int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number))
        {
            throw ApiException.Validation(message);
        }

        return number;
    }
}
