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

        return services;
    }
}
