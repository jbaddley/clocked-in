using System.Security.Claims;
using System.Text.Encodings.Web;
using ClockedIn.Api.Data;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Security;

public static class ApiKeyDefaults
{
    public const string AuthenticationScheme = "ApiKey";
}

public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ClockedInDbContext db,
    ApiKeyHasher hasher,
    CurrentUser current,
    TimeProvider time) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string HeaderName = "X-Api-Key";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var raw = ReadKey();
        if (raw is null)
        {
            return AuthenticateResult.NoResult();
        }

        var prefix = ApiKeyHasher.PrefixOf(raw);
        if (prefix is null)
        {
            hasher.VerifyDummy(raw);
            return AuthenticateResult.Fail("Authentication is required.");
        }

        var now = time.GetUtcNow().UtcDateTime;
        var keys = await db.OrganizationApiKeys.AsNoTracking()
            .Where(item => item.Prefix == prefix && item.RevokedAt == null)
            .ToListAsync(Context.RequestAborted);
        var match = keys.FirstOrDefault(item => hasher.Matches(raw, item.KeyHash));
        if (match is null)
        {
            hasher.VerifyDummy(raw);
            return AuthenticateResult.Fail("Authentication is required.");
        }

        if (match.ExpiresAt is DateTime expiresAt && expiresAt <= now)
        {
            return AuthenticateResult.Fail("Authentication is required.");
        }

        current.Set(new OrgApiKeyPrincipal
        {
            Id = match.Id,
            OrganizationId = match.OrganizationId,
            CreatedByUserId = match.CreatedByUserId,
            Scopes = ApiKeyScopeList.Parse(match.Scopes),
        });
        match.LastUsedAt = now;
        db.OrganizationApiKeys.Attach(match);
        db.Entry(match).Property(item => item.LastUsedAt).IsModified = true;
        try
        {
            await db.SaveChangesAsync(Context.RequestAborted);
        }
        catch (Exception exception)
        {
            Logger.LogWarning(exception, "Could not record API key last-used time.");
        }

        var identity = new ClaimsIdentity(
            [
                new Claim("keyId", match.Id.ToString()),
                new Claim("organizationId", match.OrganizationId.ToString()),
            ],
            Scheme.Name);
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name));
    }

    protected override async Task HandleChallengeAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status401Unauthorized;
        await Response.WriteAsJsonAsync(new ErrorResponse("unauthorized", "Authentication is required."), Context.RequestAborted);
    }

    protected override async Task HandleForbiddenAsync(AuthenticationProperties properties)
    {
        Response.StatusCode = StatusCodes.Status403Forbidden;
        await Response.WriteAsJsonAsync(new ErrorResponse("forbidden", "Forbidden."), Context.RequestAborted);
    }

    private string? ReadKey()
    {
        var header = Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var token = header["Bearer ".Length..].Trim();
            if (ApiKeyHasher.LooksLike(token))
            {
                return token;
            }
        }

        var apiKey = Request.Headers[HeaderName].ToString();
        return string.IsNullOrWhiteSpace(apiKey) ? null : apiKey.Trim();
    }
}

public static class ApiKeyScopeList
{
    public static IReadOnlyList<string> Parse(string json)
    {
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<string[]>(json) ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    public static string Format(IEnumerable<string> scopes) =>
        System.Text.Json.JsonSerializer.Serialize(scopes.Distinct().Order().ToArray());
}
