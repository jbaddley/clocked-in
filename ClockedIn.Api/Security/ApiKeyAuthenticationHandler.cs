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
        var orgKeys = await db.OrganizationApiKeys.AsNoTracking()
            .Where(item => item.Prefix == prefix && item.RevokedAt == null)
            .ToListAsync(Context.RequestAborted);
        var orgMatch = orgKeys.FirstOrDefault(item => hasher.Matches(raw, item.KeyHash));
        if (orgMatch is not null)
        {
            return await Succeed(raw, now, orgMatch.Id, orgMatch.OrganizationId, orgMatch.CreatedByUserId, orgMatch.Scopes, orgMatch.ExpiresAt, lastUsed =>
            {
                orgMatch.LastUsedAt = lastUsed;
                db.OrganizationApiKeys.Attach(orgMatch);
                db.Entry(orgMatch).Property(item => item.LastUsedAt).IsModified = true;
            });
        }

        var platformKeys = await db.PlatformApiKeys.AsNoTracking()
            .Where(item => item.Prefix == prefix && item.RevokedAt == null)
            .ToListAsync(Context.RequestAborted);
        var platformMatch = platformKeys.FirstOrDefault(item => hasher.Matches(raw, item.KeyHash));
        if (platformMatch is not null)
        {
            return await Succeed(raw, now, platformMatch.Id, null, platformMatch.CreatedByUserId, platformMatch.Scopes, platformMatch.ExpiresAt, lastUsed =>
            {
                platformMatch.LastUsedAt = lastUsed;
                db.PlatformApiKeys.Attach(platformMatch);
                db.Entry(platformMatch).Property(item => item.LastUsedAt).IsModified = true;
            });
        }

        hasher.VerifyDummy(raw);
        return AuthenticateResult.Fail("Authentication is required.");
    }

    private async Task<AuthenticateResult> Succeed(
        string raw,
        DateTime now,
        Guid keyId,
        Guid? organizationId,
        Guid createdByUserId,
        string scopes,
        DateTime? expiresAt,
        Action<DateTime> touch)
    {
        if (expiresAt is DateTime expired && expired <= now)
        {
            hasher.VerifyDummy(raw);
            return AuthenticateResult.Fail("Authentication is required.");
        }

        current.Set(new OrgApiKeyPrincipal
        {
            Id = keyId,
            OrganizationId = organizationId,
            CreatedByUserId = createdByUserId,
            Scopes = ApiKeyScopeList.Parse(scopes),
        });
        touch(now);
        try
        {
            await db.SaveChangesAsync(Context.RequestAborted);
        }
        catch (Exception exception)
        {
            Logger.LogWarning(exception, "Could not record API key last-used time.");
        }

        var claims = new List<Claim> { new("keyId", keyId.ToString()) };
        if (organizationId is Guid orgId)
        {
            claims.Add(new Claim("organizationId", orgId.ToString()));
        }
        else
        {
            claims.Add(new Claim("platform", "true"));
        }

        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name)), Scheme.Name));
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
