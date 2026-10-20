using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Security;

public sealed class OrgApiKeyPrincipal
{
    public required Guid Id { get; init; }
    public Guid? OrganizationId { get; init; }
    public required Guid CreatedByUserId { get; init; }
    public required IReadOnlyList<string> Scopes { get; init; }

    public bool IsPlatform => OrganizationId is null;

    public bool IsAdmin => IsPlatform
        ? Scopes.Contains(ApiKeyScope.PlatformAdmin, StringComparer.Ordinal)
        : Scopes.Contains(ApiKeyScope.Admin, StringComparer.Ordinal);

    public bool CanWrite => IsAdmin || (!IsPlatform && Scopes.Contains(ApiKeyScope.Write, StringComparer.Ordinal));

    public bool CanRead => CanWrite || (!IsPlatform && Scopes.Contains(ApiKeyScope.Read, StringComparer.Ordinal));
}

public static class ApiKeyScope
{
    public const string Read = "org:read";
    public const string Write = "org:write";
    public const string Admin = "org:admin";
    public const string PlatformAdmin = "platform:admin";

    public static readonly string[] Known = [Read, Write, Admin];

    public static readonly string[] Platform = [PlatformAdmin];
}

public sealed class CurrentUser
{
    private User? _user;
    private OrgApiKeyPrincipal? _apiKey;

    public User? UserOrNull => _user;

    public OrgApiKeyPrincipal? ApiKey => _apiKey;

    public bool IsApiKey => _apiKey is not null;

    public User User => _user ?? throw ApiException.Unauthorized();

    public Guid Id => User.Id;

    public bool IsSuperAdmin => _user?.IsSuperAdmin ?? false;

    internal void Set(User user) => _user = user;

    internal void Set(OrgApiKeyPrincipal key) => _apiKey = key;
}
