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

public sealed record OrganizationApiKeyDto(
    Guid Id,
    Guid OrganizationId,
    string Name,
    string Prefix,
    IReadOnlyList<string> Scopes,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    DateTime? LastUsedAt,
    DateTime? ExpiresAt,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Key)
{
    public static OrganizationApiKeyDto From(OrganizationApiKey key, string? secret = null) => new(
        key.Id,
        key.OrganizationId,
        key.Name,
        key.Prefix,
        ApiKeyScopeList.Parse(key.Scopes),
        key.CreatedByUserId,
        key.CreatedAt,
        key.LastUsedAt,
        key.ExpiresAt,
        secret is null ? null : ApiKeyHasher.Combine(key.Prefix, secret));
}

public sealed record CreateApiKeyRequest(string Name, IReadOnlyList<string> Scopes, DateTime? ExpiresAt)
{
    public static async ValueTask<CreateApiKeyRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreateApiKeyRequest Parse(JsonObject body) => new(
        ApiKeyFields.RequireName(body),
        ApiKeyFields.RequireScopes(body),
        ApiKeyFields.OptionalExpiry(body));
}

public sealed record UpdateApiKeyRequest(Optional<string> Name, Optional<IReadOnlyList<string>> Scopes, Optional<DateTime?> ExpiresAt)
{
    public static async ValueTask<UpdateApiKeyRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateApiKeyRequest Parse(JsonObject body)
    {
        var request = new UpdateApiKeyRequest(
            Optional.Read(body, "name", (_, _) => ApiKeyFields.RequireName(body)),
            Optional.Read(body, "scopes", (_, _) => ApiKeyFields.RequireScopes(body)),
            Optional.Read(body, "expiresAt", (_, _) => ApiKeyFields.OptionalExpiry(body)));
        if (!request.Name.HasValue && !request.Scopes.HasValue && !request.ExpiresAt.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }
}

public sealed class OrganizationApiKeysService(
    ClockedInDbContext db,
    Access access,
    ApiKeyHasher hasher,
    TimeProvider time,
    IHostEnvironment environment)
{
    public async Task<ListResponse<OrganizationApiKeyDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        access.RequireHuman();
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var page = query.Resolve();
        var keys = await db.OrganizationApiKeys.AsNoTracking()
            .Where(key => key.OrganizationId == organizationId && key.RevokedAt == null)
            .OrderByDescending(key => key.CreatedAt)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(keys.Select(key => OrganizationApiKeyDto.From(key)).ToList(), page);
    }

    public async Task<OrganizationApiKeyDto> Create(Guid organizationId, CreateApiKeyRequest request, CancellationToken cancellationToken)
    {
        var user = access.RequireHuman();
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var (prefix, secret) = hasher.Issue(environment.EnvironmentName);
        var now = time.GetUtcNow().UtcDateTime;
        var key = new OrganizationApiKey
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            Name = request.Name,
            Prefix = prefix,
            KeyHash = hasher.Hash(ApiKeyHasher.Combine(prefix, secret)),
            Scopes = ApiKeyScopeList.Format(request.Scopes),
            CreatedByUserId = user.Id,
            CreatedAt = now,
            ExpiresAt = request.ExpiresAt,
        };
        db.OrganizationApiKeys.Add(key);
        await db.SaveOrThrowAsync(cancellationToken);
        return OrganizationApiKeyDto.From(key, secret);
    }

    public async Task<OrganizationApiKeyDto> Update(Guid organizationId, Guid keyId, UpdateApiKeyRequest request, CancellationToken cancellationToken)
    {
        access.RequireHuman();
        var key = await Managed(organizationId, keyId, cancellationToken);
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
        return OrganizationApiKeyDto.From(key);
    }

    public async Task<OrganizationApiKeyDto> Rotate(Guid organizationId, Guid keyId, CancellationToken cancellationToken)
    {
        access.RequireHuman();
        var key = await Managed(organizationId, keyId, cancellationToken);
        var (prefix, secret) = hasher.Issue(environment.EnvironmentName);
        key.Prefix = prefix;
        key.KeyHash = hasher.Hash(ApiKeyHasher.Combine(prefix, secret));
        await db.SaveOrThrowAsync(cancellationToken);
        return OrganizationApiKeyDto.From(key, secret);
    }

    public async Task Revoke(Guid organizationId, Guid keyId, CancellationToken cancellationToken)
    {
        access.RequireHuman();
        var key = await Managed(organizationId, keyId, cancellationToken);
        key.RevokedAt = time.GetUtcNow().UtcDateTime;
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<OrganizationApiKey> Managed(Guid organizationId, Guid keyId, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var key = await db.OrganizationApiKeys.FirstOrDefaultAsync(
            item => item.Id == keyId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();
        if (key.RevokedAt is not null)
        {
            throw ApiException.NotFound();
        }

        return key;
    }
}

public static class OrganizationApiKeysEndpoints
{
    public static void MapOrganizationApiKeysEndpoints(this IEndpointRouteBuilder app)
    {
        var keys = app.MapGroup("/organizations/{id:guid}/api-keys").RequireAuthorization();
        keys.MapGet("", async Task<Ok<ListResponse<OrganizationApiKeyDto>>> (Guid id, [AsParameters] PageQuery query, OrganizationApiKeysService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        keys.MapPost("", async Task<Created<OrganizationApiKeyDto>> (Guid id, CreateApiKeyRequest request, OrganizationApiKeysService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));
        keys.MapPatch("/{keyId:guid}", async Task<Ok<OrganizationApiKeyDto>> (Guid id, Guid keyId, UpdateApiKeyRequest request, OrganizationApiKeysService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, keyId, request, ct)));
        keys.MapPost("/{keyId:guid}/rotate", async Task<Ok<OrganizationApiKeyDto>> (Guid id, Guid keyId, OrganizationApiKeysService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Rotate(id, keyId, ct)));
        keys.MapDelete("/{keyId:guid}", async Task<NoContent> (Guid id, Guid keyId, OrganizationApiKeysService service, CancellationToken ct) =>
        {
            await service.Revoke(id, keyId, ct);
            return TypedResults.NoContent();
        });
    }
}

internal static class ApiKeyFields
{
    public static string RequireName(JsonObject body)
    {
        var name = Fields.RequiredString(body, "name").Trim();
        if (name.Length is < 1 or > 80)
        {
            throw ApiException.Validation("name must be 1 to 80 characters.");
        }

        return name;
    }

    public static IReadOnlyList<string> RequireScopes(JsonObject body)
    {
        if (body["scopes"] is not JsonArray array || array.Count == 0)
        {
            throw ApiException.Validation("scopes must be a non-empty array.");
        }

        var scopes = array.Select((item, index) =>
        {
            var value = item?.GetValue<string>() ?? throw ApiException.Validation($"scopes[{index}] must be a string.");
            if (!ApiKeyScope.Known.Contains(value))
            {
                throw ApiException.Validation("scopes must be org:read, org:write, or org:admin.");
            }

            return value;
        }).Distinct().ToList();
        return scopes;
    }

    public static DateTime? OptionalExpiry(JsonObject body)
    {
        if (!Fields.Has(body, "expiresAt") || body["expiresAt"] is null)
        {
            return null;
        }

        return Fields.RequiredInstant(body, "expiresAt");
    }
}
