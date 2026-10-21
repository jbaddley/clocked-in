using ClockedIn.Api.Data;

namespace ClockedIn.Api.Configuration;

public sealed class JwtOptions
{
    public string SigningKey { get; set; } = "";
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
}

public sealed class EmailOptions
{
    public const string DefaultUrl = "https://api.resend.com/emails";

    public const string DefaultAppUrl = "http://localhost:3025";

    public string? ApiKey { get; set; }
    public string? From { get; set; }
    public string Url { get; set; } = DefaultUrl;
    public string AppUrl { get; set; } = DefaultAppUrl;

    public string Link(string path)
    {
        var baseUrl = string.IsNullOrWhiteSpace(AppUrl) ? DefaultAppUrl : AppUrl.TrimEnd('/');
        return $"{baseUrl}{(path.StartsWith('/') ? path : "/" + path)}";
    }
}

public sealed class DatabaseOptions
{
    public string ConnectionString { get; set; } = "";
}

public sealed class ApiKeyOptions
{
    public string Pepper { get; set; } = "";
}

public sealed class GithubOptions
{
    public const string DefaultUrl = "https://api.github.com";

    public string? Token { get; set; }
    public string? Repo { get; set; }
    public string Url { get; set; } = DefaultUrl;

    public bool TryRepo(out string owner, out string name)
    {
        owner = "";
        name = "";
        var value = Repo?.Trim() ?? "";
        var slash = value.IndexOf('/');
        if (slash <= 0 || slash != value.LastIndexOf('/') || slash == value.Length - 1)
        {
            return false;
        }

        owner = value[..slash];
        name = value[(slash + 1)..];
        return owner.Length > 0 && name.Length > 0;
    }
}

public static class CorsOrigins
{
    public static string[] From(IConfiguration configuration)
    {
        var configured = configuration["CORS_ORIGINS"]?
            .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            ?? [];
        if (configured.Length > 0)
        {
            return configured;
        }

        var appUrl = configuration["APP_URL"]?.Trim();
        if (string.IsNullOrWhiteSpace(appUrl) || !Uri.TryCreate(appUrl, UriKind.Absolute, out var uri))
        {
            return [];
        }

        return [$"{uri.Scheme}://{uri.Authority}"];
    }
}

public sealed class PortalOptions
{
    public bool PublicSignup { get; set; } = true;
}

public static class OptionsSetup
{
    public static IServiceCollection AddClockedInOptions(this IServiceCollection services)
    {
        services.AddOptions<JwtOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.SigningKey = configuration["JWT_SIGNING_KEY"] ?? "";
                options.Issuer = configuration["JWT_ISSUER"] ?? "";
                options.Audience = configuration["JWT_AUDIENCE"] ?? "";
            })
            .Validate(
                options => options.SigningKey.Length >= 32 && options.Issuer.Length > 0 && options.Audience.Length > 0,
                "JWT_SIGNING_KEY, JWT_ISSUER, and JWT_AUDIENCE must be set.")
            .ValidateOnStart();

        services.AddOptions<EmailOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.ApiKey = configuration["RESEND_API_KEY"];
                options.From = configuration["EMAIL_FROM"];
                var url = configuration["RESEND_API_URL"];
                options.Url = string.IsNullOrWhiteSpace(url) ? EmailOptions.DefaultUrl : url;
                var appUrl = configuration["APP_URL"];
                options.AppUrl = string.IsNullOrWhiteSpace(appUrl) ? EmailOptions.DefaultAppUrl : appUrl.TrimEnd('/');
            })
            .Validate(options => Uri.IsWellFormedUriString(options.Url, UriKind.Absolute), "RESEND_API_URL must be an absolute URL.")
            .Validate(options => Uri.IsWellFormedUriString(options.AppUrl, UriKind.Absolute), "APP_URL must be an absolute URL.")
            .ValidateOnStart();

        services.AddOptions<DatabaseOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                var url = configuration[EfConnection.EnvironmentVariable];
                options.ConnectionString = string.IsNullOrWhiteSpace(url) ? "" : EfConnection.Normalize(url);
            })
            .Validate(options => options.ConnectionString.Length > 0, $"{EfConnection.EnvironmentVariable} is not set.")
            .ValidateOnStart();

        services.AddOptions<ApiKeyOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.Pepper = configuration["API_KEY_PEPPER"] ?? "";
            })
            .Validate(options => options.Pepper.Length >= 32, "API_KEY_PEPPER must be at least 32 characters.")
            .ValidateOnStart();

        services.AddOptions<GithubOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.Token = configuration["GITHUB_TOKEN"];
                options.Repo = configuration["GITHUB_REPO"];
                var url = configuration["GITHUB_API_URL"];
                options.Url = string.IsNullOrWhiteSpace(url) ? GithubOptions.DefaultUrl : url.TrimEnd('/');
            })
            .Validate(options => Uri.IsWellFormedUriString(options.Url, UriKind.Absolute), "GITHUB_API_URL must be an absolute URL.")
            .ValidateOnStart();

        services.AddOptions<PortalOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                var value = configuration["PUBLIC_SIGNUP"]?.Trim().ToLowerInvariant();
                options.PublicSignup = value is not "false" and not "0" and not "no";
            });

        return services;
    }
}
