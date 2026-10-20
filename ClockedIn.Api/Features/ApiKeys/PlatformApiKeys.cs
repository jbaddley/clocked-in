using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.ApiKeys;

public sealed record PlatformApiKeyDto(
    Guid Id,
    string Name,
    string Prefix,
    IReadOnlyList<string> Scopes,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    DateTime? LastUsedAt,
    DateTime? ExpiresAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Key)
{
    public static PlatformApiKeyDto From(PlatformApiKey key, string? secret = null) => new(
        key.Id,
        key.Name,
        key.Prefix,
        ApiKeyScopeList.Parse(key.Scopes),
        key.CreatedByUserId,
        key.CreatedAt,
        key.LastUsedAt,
        key.ExpiresAt,
        secret is null ? null : ApiKeyHasher.Combine(key.Prefix, secret));
}

public sealed record CreatePlatformApiKeyRequest(string Name, IReadOnlyList<string> Scopes, DateTime? ExpiresAt)
{
    public static async ValueTask<CreatePlatformApiKeyRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreatePlatformApiKeyRequest Parse(JsonObject body) => new(
        ApiKeyFields.RequireName(body),
        PlatformApiKeyFields.RequireScopes(body),
        ApiKeyFields.OptionalExpiry(body));
}

public sealed record UpdatePlatformApiKeyRequest(Optional<string> Name, Optional<IReadOnlyList<string>> Scopes, Optional<DateTime?> ExpiresAt)
{
    public static async ValueTask<UpdatePlatformApiKeyRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdatePlatformApiKeyRequest Parse(JsonObject body)
    {
        var request = new UpdatePlatformApiKeyRequest(
            Optional.Read(body, "name", (_, _) => ApiKeyFields.RequireName(body)),
            Optional.Read(body, "scopes", (_, _) => PlatformApiKeyFields.RequireScopes(body)),
            Optional.Read(body, "expiresAt", (_, _) => ApiKeyFields.OptionalExpiry(body)));
        if (!request.Name.HasValue && !request.Scopes.HasValue && !request.ExpiresAt.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }
}

public sealed class PlatformApiKeysService(
    ClockedInDbContext db,
    Access access,
    ApiKeyHasher hasher,
    TimeProvider time,
    IHostEnvironment environment)
{
    public async Task<ListResponse<PlatformApiKeyDto>> List(PageQuery query, CancellationToken cancellationToken)
    {
        access.RequireSuperAdmin();
        var page = query.Resolve();
        var keys = await db.PlatformApiKeys.AsNoTracking()
            .Where(key => key.RevokedAt == null)
            .OrderByDescending(key => key.CreatedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(keys.Select(key => PlatformApiKeyDto.From(key)).ToList(), page);
    }

    public async Task<PlatformApiKeyDto> Create(CreatePlatformApiKeyRequest request, CancellationToken cancellationToken)
    {
        var user = access.RequireSuperAdmin();
        var (prefix, secret) = hasher.Issue(environment.EnvironmentName);
        var now = time.GetUtcNow().UtcDateTime;
        var key = new PlatformApiKey
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Prefix = prefix,
            KeyHash = hasher.Hash(ApiKeyHasher.Combine(prefix, secret)),
            Scopes = ApiKeyScopeList.Format(request.Scopes),
            CreatedByUserId = user.Id,
            CreatedAt = now,
            ExpiresAt = request.ExpiresAt,
        };
        db.PlatformApiKeys.Add(key);
        await db.SaveOrThrowAsync(cancellationToken);
        return PlatformApiKeyDto.From(key, secret);
    }

    public async Task<PlatformApiKeyDto> Update(Guid keyId, UpdatePlatformApiKeyRequest request, CancellationToken cancellationToken)
    {
        access.RequireSuperAdmin();
        var key = await Managed(keyId, cancellationToken);
        key.Name = request.Name.Or(key.Name);
        if (request.Scopes.HasValue)
        {
            key.Scopes = ApiKeyScopeList.Format(request.Scopes.Value);
        }

        if (request.ExpiresAt.HasValue)
        {
            key.ExpiresAt = request.ExpiresAt.Value;
        }

        await db.SaveOrThrowAsync(cancellationToken);
        return PlatformApiKeyDto.From(key);
    }

    public async Task<PlatformApiKeyDto> Rotate(Guid keyId, CancellationToken cancellationToken)
    {
        access.RequireSuperAdmin();
        var key = await Managed(keyId, cancellationToken);
        var (prefix, secret) = hasher.Issue(environment.EnvironmentName);
        key.Prefix = prefix;
        key.KeyHash = hasher.Hash(ApiKeyHasher.Combine(prefix, secret));
        await db.SaveOrThrowAsync(cancellationToken);
        return PlatformApiKeyDto.From(key, secret);
    }

    public async Task Revoke(Guid keyId, CancellationToken cancellationToken)
    {
        access.RequireSuperAdmin();
        var key = await Managed(keyId, cancellationToken);
        key.RevokedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<PlatformApiKey> Managed(Guid keyId, CancellationToken cancellationToken)
    {
        var key = await db.PlatformApiKeys.FirstOrDefaultAsync(item => item.Id == keyId, cancellationToken)
            ?? throw ApiException.NotFound();
        if (key.RevokedAt is not null)
        {
            throw ApiException.NotFound();
        }

        return key;
    }
}

public static class PlatformApiKeysEndpoints
{
    public static void MapPlatformApiKeysEndpoints(this IEndpointRouteBuilder app)
    {
        var keys = app.MapGroup("/platform/api-keys").RequireAuthorization();
        keys.MapGet("", async Task<Ok<ListResponse<PlatformApiKeyDto>>> ([AsParameters] PageQuery query, PlatformApiKeysService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(query, ct)));
        keys.MapPost("", async Task<Created<PlatformApiKeyDto>> (CreatePlatformApiKeyRequest request, PlatformApiKeysService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(request, ct)));
        keys.MapPatch("/{keyId:guid}", async Task<Ok<PlatformApiKeyDto>> (Guid keyId, UpdatePlatformApiKeyRequest request, PlatformApiKeysService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(keyId, request, ct)));
        keys.MapPost("/{keyId:guid}/rotate", async Task<Ok<PlatformApiKeyDto>> (Guid keyId, PlatformApiKeysService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Rotate(keyId, ct)));
        keys.MapDelete("/{keyId:guid}", async Task<NoContent> (Guid keyId, PlatformApiKeysService service, CancellationToken ct) =>
        {
            await service.Revoke(keyId, ct);
            return TypedResults.NoContent();
        });
    }
}

internal static class PlatformApiKeyFields
{
    public static IReadOnlyList<string> RequireScopes(JsonObject body)
    {
        if (body["scopes"] is not JsonArray array || array.Count == 0)
        {
            throw ApiException.Validation("scopes must be a non-empty array.");
        }

        var scopes = array.Select((item, index) =>
        {
            var value = item?.GetValue<string>() ?? throw ApiException.Validation($"scopes[{index}] must be a string.");
            if (!ApiKeyScope.Platform.Contains(value))
            {
                throw ApiException.Validation("scopes must be platform:admin.");
            }

            return value;
        }).Distinct().ToList();
        return scopes;
    }
}
