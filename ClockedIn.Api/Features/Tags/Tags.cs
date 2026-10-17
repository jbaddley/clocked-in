using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Tags;

public sealed record TagDto(Guid Id, Guid OrganizationId, string Name)
{
    public static TagDto From(Tag tag) => new(tag.Id, tag.OrganizationId, tag.Name);
}

public sealed class TagsService(ClockedInDbContext db, Access access)
{
    public async Task<ListResponse<TagDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var tags = await db.Tags.AsNoTracking()
            .Where(tag => tag.OrganizationId == organizationId)
            .OrderBy(tag => tag.Name)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(tags.Select(TagDto.From).ToList(), page);
    }

    public async Task<TagDto> Create(Guid organizationId, NameRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, true, cancellationToken);
        var tag = new Tag { Id = Guid.NewGuid(), OrganizationId = organizationId, Name = request.Name };
        db.Tags.Add(tag);
        await db.SaveOrThrowAsync(cancellationToken);
        return TagDto.From(tag);
    }

    public async Task<TagDto> Update(Guid tagId, NameRequest request, CancellationToken cancellationToken)
    {
        var tag = await Managed(tagId, cancellationToken);
        tag.Name = request.Name;
        await db.SaveOrThrowAsync(cancellationToken);
        return TagDto.From(tag);
    }

    public async Task Delete(Guid tagId, CancellationToken cancellationToken)
    {
        db.Tags.Remove(await Managed(tagId, cancellationToken));
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<Tag> Managed(Guid tagId, CancellationToken cancellationToken)
    {
        var tag = await db.Tags.FirstOrDefaultAsync(item => item.Id == tagId, cancellationToken) ?? throw ApiException.NotFound();
        await access.RequireOrganization(tag.OrganizationId, true, cancellationToken);
        return tag;
    }
}

public static class TagsEndpoints
{
    public static void MapTagsEndpoints(this IEndpointRouteBuilder app)
    {
        var byOrganization = app.MapGroup("/organizations/{id:guid}/tags").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<TagDto>>> (Guid id, [AsParameters] PageQuery query, TagsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        byOrganization.MapPost("", async Task<Created<TagDto>> (Guid id, NameRequest request, TagsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var tags = app.MapGroup("/tags").RequireAuthorization();
        tags.MapPatch("/{id:guid}", async Task<Ok<TagDto>> (Guid id, NameRequest request, TagsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        tags.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, TagsService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
