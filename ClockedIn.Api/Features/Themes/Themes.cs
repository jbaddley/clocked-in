using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.Themes;

public static class ThemesEndpoints
{
    public static void MapThemesEndpoints(this IEndpointRouteBuilder app)
    {
        var themes = app.MapGroup("/organizations/{organizationId:guid}/themes").RequireAuthorization();
        themes.MapGet("", async Task<Ok<ListResponse<ThemeDto>>> (Guid organizationId, ThemesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(organizationId, ct)));
        themes.MapPost("", async Task<Created<ThemeDto>> (Guid organizationId, ThemeWriteRequest request, ThemesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(organizationId, request, ct)));
        themes.MapPatch("/{id:guid}", async Task<Ok<ThemeDto>> (Guid organizationId, Guid id, ThemeWriteRequest request, ThemesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(organizationId, id, request, ct)));
        themes.MapDelete("/{id:guid}", async Task<NoContent> (Guid organizationId, Guid id, ThemesService service, CancellationToken ct) =>
        {
            await service.Delete(organizationId, id, ct);
            return TypedResults.NoContent();
        });
    }
}

public sealed class ThemesService(ClockedInDbContext db, Access access)
{
    public async Task<ListResponse<ThemeDto>> List(Guid organizationId, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var items = await db.Themes.AsNoTracking()
            .Where(theme => theme.OrganizationId == null || theme.OrganizationId == organizationId)
            .OrderBy(theme => theme.OrganizationId == null ? 0 : 1)
            .ThenBy(theme => theme.Name)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(items.Select(ThemeDto.From).ToList(), new Page(items.Count, 0));
    }

    public async Task<ThemeDto> Create(Guid organizationId, ThemeWriteRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var theme = new Theme { Id = Guid.NewGuid(), OrganizationId = organizationId };
        request.ApplyTo(theme);
        db.Themes.Add(theme);
        await db.SaveOrThrowAsync(cancellationToken);
        return ThemeDto.From(theme);
    }

    public async Task<ThemeDto> Update(Guid organizationId, Guid themeId, ThemeWriteRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var theme = await db.Themes.FirstOrDefaultAsync(
            item => item.Id == themeId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();
        request.ApplyTo(theme);
        await db.SaveOrThrowAsync(cancellationToken);
        return ThemeDto.From(theme);
    }

    public async Task Delete(Guid organizationId, Guid themeId, CancellationToken cancellationToken)
    {
        var organization = await access.RequireOrganizationAdmin(organizationId, cancellationToken);
        var theme = await db.Themes.FirstOrDefaultAsync(
            item => item.Id == themeId && item.OrganizationId == organizationId,
            cancellationToken) ?? throw ApiException.NotFound();
        if (organization.ThemeId == theme.Id)
        {
            organization.ThemeId = Theme.ClockedInId;
        }

        db.Themes.Remove(theme);
        await db.SaveOrThrowAsync(cancellationToken);
    }
}
