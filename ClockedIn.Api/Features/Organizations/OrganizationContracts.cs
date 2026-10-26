using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Users;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Organizations;

public sealed record EntityLabelsDto(string Organization, string Project, string Department, string TaskCategory)
{
    public static EntityLabelsDto From(EntityLabels? labels) =>
        new(
            Label(labels?.Organization, "Organization"),
            Label(labels?.Project, "Project"),
            Label(labels?.Department, "Department"),
            Label(labels?.TaskCategory, "Task category"));

    public static EntityLabelsDto Parse(JsonNode? node)
    {
        if (node is not JsonObject body)
        {
            throw ApiException.Validation("entityLabels must be an object.");
        }

        return new(
            RequiredLabel(body, "organization"),
            RequiredLabel(body, "project"),
            RequiredLabel(body, "department"),
            RequiredLabel(body, "taskCategory"));
    }

    public EntityLabels ToEntity() => new()
    {
        Organization = Organization,
        Project = Project,
        Department = Department,
        TaskCategory = TaskCategory,
    };

    private static string Label(string? value, string fallback)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? fallback : trimmed;
    }

    private static string RequiredLabel(JsonObject body, string key)
    {
        var value = Fields.RequiredString(body, key).Trim();
        if (value.Length is < 1 or > 40)
        {
            throw ApiException.Validation($"{key} must be 1 to 40 characters.");
        }

        return value;
    }
}

public sealed record OrganizationPreferencesDto(
    bool AllowTimeEntryEditing,
    bool AllowVolunteersToAddVolunteers,
    EntityLabelsDto EntityLabels,
    IReadOnlyList<Guid> FeedbackNotifyUserIds)
{
    public static OrganizationPreferencesDto From(OrganizationPreferences? preferences) =>
        new(
            preferences?.AllowTimeEntryEditing ?? false,
            preferences?.AllowVolunteersToAddVolunteers ?? false,
            EntityLabelsDto.From(preferences?.EntityLabels),
            preferences?.FeedbackNotifyUserIds ?? []);

    public static OrganizationPreferencesDto Parse(JsonNode? node)
    {
        if (node is not JsonObject body)
        {
            throw ApiException.Validation("preferences must be an object.");
        }

        return new(
            Fields.RequiredBool(body, "allowTimeEntryEditing"),
            Fields.Has(body, "allowVolunteersToAddVolunteers")
                ? Fields.RequiredBool(body, "allowVolunteersToAddVolunteers")
                : false,
            Fields.Has(body, "entityLabels")
                ? EntityLabelsDto.Parse(body["entityLabels"])
                : EntityLabelsDto.From(null),
            Fields.Has(body, "feedbackNotifyUserIds")
                ? Fields.Ids(body, "feedbackNotifyUserIds", optional: false).Distinct().ToList()
                : []);
    }
}

public sealed record ThemeDto(
    Guid Id,
    string Name,
    Guid? OrganizationId,
    string Primary,
    string PrimaryForeground,
    string Highlight,
    string Accent,
    string Success,
    string Surface,
    string SurfaceForeground,
    string Foreground,
    string ChartColor,
    string HeadingFont,
    string BodyFont,
    IReadOnlyList<string> CategoricalPalette,
    IReadOnlyList<string> SequentialPalette,
    IReadOnlyList<string> DivergingPalette)
{
    public static ThemeDto From(Theme theme) => new(
        theme.Id,
        theme.Name,
        theme.OrganizationId,
        theme.Primary,
        theme.PrimaryForeground,
        theme.Highlight,
        theme.Accent,
        theme.Success,
        theme.Surface,
        theme.SurfaceForeground,
        theme.Foreground,
        theme.ChartColor,
        theme.HeadingFont,
        theme.BodyFont,
        ParsePalette(theme.CategoricalPalette),
        ParsePalette(theme.SequentialPalette),
        ParsePalette(theme.DivergingPalette));

    public static IReadOnlyList<string> ParsePalette(string json)
    {
        try
        {
            return JsonNode.Parse(json)?.AsArray().Select(item => item?.GetValue<string>() ?? "").Where(item => item.Length > 0).ToList()
                ?? [];
        }
        catch (Exception)
        {
            return [];
        }
    }
}

public sealed record ThemeWriteRequest(
    string Name,
    string Primary,
    string PrimaryForeground,
    string Highlight,
    string Accent,
    string Success,
    string Surface,
    string SurfaceForeground,
    string Foreground,
    string ChartColor,
    string HeadingFont,
    string BodyFont,
    IReadOnlyList<string> CategoricalPalette,
    IReadOnlyList<string> SequentialPalette,
    IReadOnlyList<string> DivergingPalette)
{
    public static async ValueTask<ThemeWriteRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static ThemeWriteRequest Parse(JsonObject body) => new(
        Fields.RequireName(Fields.RequiredString(body, "name")),
        Hex(body, "primary"),
        Hex(body, "primaryForeground"),
        Hex(body, "highlight"),
        Hex(body, "accent"),
        Hex(body, "success"),
        Hex(body, "surface"),
        Hex(body, "surfaceForeground"),
        Hex(body, "foreground"),
        Hex(body, "chartColor"),
        Font(body, "headingFont"),
        Font(body, "bodyFont"),
        Palette(body, "categoricalPalette", 6, 8),
        Palette(body, "sequentialPalette", 5, 10),
        Palette(body, "divergingPalette", 7, 7));

    public void ApplyTo(Theme theme)
    {
        theme.Name = Name;
        theme.Primary = Primary;
        theme.PrimaryForeground = PrimaryForeground;
        theme.Highlight = Highlight;
        theme.Accent = Accent;
        theme.Success = Success;
        theme.Surface = Surface;
        theme.SurfaceForeground = SurfaceForeground;
        theme.Foreground = Foreground;
        theme.ChartColor = ChartColor;
        theme.HeadingFont = HeadingFont;
        theme.BodyFont = BodyFont;
        theme.CategoricalPalette = GlobalThemes.Palette(CategoricalPalette);
        theme.SequentialPalette = GlobalThemes.Palette(SequentialPalette);
        theme.DivergingPalette = GlobalThemes.Palette(DivergingPalette);
    }

    private static string Hex(JsonObject body, string key)
    {
        var value = Fields.RequiredString(body, key);
        if (!Regex.IsMatch(value, "^#[0-9A-Fa-f]{6}$"))
        {
            throw ApiException.Validation($"{key} must be a #RRGGBB color.");
        }

        return value.ToUpperInvariant();
    }

    private static string Font(JsonObject body, string key)
    {
        var value = Fields.RequiredString(body, key);
        if (value is not ("HelveticaNeue" or "AvenirNext" or "SourceSans3" or "NunitoSans" or "Geist"))
        {
            throw ApiException.Validation($"{key} must be HelveticaNeue, AvenirNext, SourceSans3, NunitoSans, or Geist.");
        }

        return value;
    }

    private static IReadOnlyList<string> Palette(JsonObject body, string key, int min, int max)
    {
        if (body[key] is not JsonArray array)
        {
            throw ApiException.Validation($"{key} must be an array of #RRGGBB colors.");
        }

        var colors = array.Select((item, index) =>
        {
            var value = item?.GetValue<string>() ?? throw ApiException.Validation($"{key}[{index}] must be a #RRGGBB color.");
            if (!Regex.IsMatch(value, "^#[0-9A-Fa-f]{6}$"))
            {
                throw ApiException.Validation($"{key}[{index}] must be a #RRGGBB color.");
            }

            return value.ToUpperInvariant();
        }).ToList();
        if (colors.Count < min || colors.Count > max)
        {
            throw ApiException.Validation($"{key} must have {min} to {max} colors.");
        }

        return colors;
    }
}

public sealed record OrganizationDto(
    Guid Id,
    string Name,
    decimal VolunteerHourlyRate,
    string DefaultRateType,
    OrganizationPreferencesDto Preferences,
    Guid ThemeId,
    ThemeDto Theme,
    string? WordmarkUrl,
    string? WordmarkOnLightUrl,
    string? MarkUrl,
    string? AccentImageUrl,
    string? Description,
    string? WebsiteUrl)
{
    public static OrganizationDto From(Organization organization, decimal volunteerHourlyRate) => new(
        organization.Id,
        organization.Name,
        volunteerHourlyRate,
        organization.DefaultRateType.ToString(),
        OrganizationPreferencesDto.From(organization.Preferences),
        organization.ThemeId,
        ThemeDto.From(organization.Theme),
        organization.WordmarkUrl,
        organization.WordmarkOnLightUrl,
        organization.MarkUrl,
        organization.AccentImageUrl,
        organization.Description,
        organization.WebsiteUrl);
}

public sealed record NameRequest(string Name)
{
    public static async ValueTask<NameRequest?> BindAsync(HttpContext context) =>
        new(Fields.RequireName(Fields.RequiredString(await Body.Read(context), "name")));
}

public sealed record UpdateOrganizationRequest(
    Optional<string> Name,
    Optional<decimal> VolunteerHourlyRate,
    Optional<RateType> DefaultRateType,
    Optional<OrganizationPreferencesDto> Preferences,
    Optional<Guid> ThemeId,
    Optional<string?> WordmarkUrl,
    Optional<string?> WordmarkOnLightUrl,
    Optional<string?> MarkUrl,
    Optional<string?> AccentImageUrl,
    Optional<string?> Description,
    Optional<string?> WebsiteUrl)
{
    public static async ValueTask<UpdateOrganizationRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateOrganizationRequest Parse(JsonObject body)
    {
        var request = new UpdateOrganizationRequest(
            Optional.Read(body, "name", (b, k) => Fields.RequireName(Fields.RequiredString(b, k))),
            Optional.Read(body, "volunteerHourlyRate", (b, k) =>
            {
                var rate = Fields.RequiredDecimal(b, k);
                if (rate <= 0)
                {
                    throw ApiException.Validation("volunteerHourlyRate must be greater than zero.");
                }

                return Fields.RoundMoney(rate);
            }),
            Optional.Read(body, "defaultRateType", (b, k) => Fields.NormalizeRateType(Fields.RequiredString(b, k))),
            Optional.Read(body, "preferences", (b, k) => OrganizationPreferencesDto.Parse(b[k])),
            Optional.Read(body, "themeId", Fields.RequiredGuid),
            Optional.Read(body, "wordmarkUrl", BrandUrl),
            Optional.Read(body, "wordmarkOnLightUrl", BrandUrl),
            Optional.Read(body, "markUrl", BrandUrl),
            Optional.Read(body, "accentImageUrl", BrandUrl),
            Optional.Read(body, "description", (b, k) => UpdateUserRequest.Limited(b, k, 8000, "description must be 8000 characters or fewer.")),
            Optional.Read(body, "websiteUrl", (b, k) => UpdateUserRequest.Limited(b, k, 2000, "websiteUrl must be a URL.")));
        if (!request.Name.HasValue
            && !request.VolunteerHourlyRate.HasValue
            && !request.DefaultRateType.HasValue
            && !request.Preferences.HasValue
            && !request.ThemeId.HasValue
            && !request.WordmarkUrl.HasValue
            && !request.WordmarkOnLightUrl.HasValue
            && !request.MarkUrl.HasValue
            && !request.AccentImageUrl.HasValue
            && !request.Description.HasValue
            && !request.WebsiteUrl.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }

    private static string? BrandUrl(JsonObject body, string key)
    {
        if (!Fields.Has(body, key) || body[key] is null)
        {
            return null;
        }

        var value = Fields.RequiredString(body, key);
        if (value.Length > 2000)
        {
            throw ApiException.Validation($"{key} must be a URL.");
        }

        return value;
    }
}
