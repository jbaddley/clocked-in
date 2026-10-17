using ClockedIn.Api.Data;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Organizations;
using ClockedIn.Api.Features.Shared;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace ClockedIn.Api.Features.TaskCategories;

public sealed record TaskCategoryDto(Guid Id, Guid OrganizationId, string Name)
{
    public static TaskCategoryDto From(TaskCategory category) => new(category.Id, category.OrganizationId, category.Name);
}

public sealed class TaskCategoriesService(ClockedInDbContext db, Access access)
{
    public async Task<ListResponse<TaskCategoryDto>> List(Guid organizationId, PageQuery query, CancellationToken cancellationToken)
    {
        var page = query.Resolve();
        await access.RequireOrganization(organizationId, false, cancellationToken);
        var categories = await db.TaskCategories.AsNoTracking()
            .Where(category => category.OrganizationId == organizationId)
            .OrderBy(category => category.Name)
            .Skip(page.Offset)
            .Take(page.Limit)
            .ToListAsync(cancellationToken);
        return ListResponse.Of(categories.Select(TaskCategoryDto.From).ToList(), page);
    }

    public async Task<TaskCategoryDto> Create(Guid organizationId, NameRequest request, CancellationToken cancellationToken)
    {
        await access.RequireOrganization(organizationId, true, cancellationToken);
        var category = new TaskCategory { Id = Guid.NewGuid(), OrganizationId = organizationId, Name = request.Name };
        db.TaskCategories.Add(category);
        await db.SaveOrThrowAsync(cancellationToken);
        return TaskCategoryDto.From(category);
    }

    public async Task<TaskCategoryDto> Update(Guid categoryId, NameRequest request, CancellationToken cancellationToken)
    {
        var category = await Managed(categoryId, cancellationToken);
        category.Name = request.Name;
        await db.SaveOrThrowAsync(cancellationToken);
        return TaskCategoryDto.From(category);
    }

    public async Task Delete(Guid categoryId, CancellationToken cancellationToken)
    {
        var category = await Managed(categoryId, cancellationToken);
        if (await db.UserTimeEntries.AnyAsync(entry => entry.TaskCategoryId == categoryId, cancellationToken)
            || await db.CollectiveTimeEntries.AnyAsync(entry => entry.TaskCategoryId == categoryId, cancellationToken))
        {
            throw ApiException.Conflict("Delete the time entries first.");
        }

        db.TaskCategories.Remove(category);
        await db.SaveOrThrowAsync(cancellationToken);
    }

    private async Task<TaskCategory> Managed(Guid categoryId, CancellationToken cancellationToken)
    {
        var category = await db.TaskCategories.FirstOrDefaultAsync(item => item.Id == categoryId, cancellationToken)
            ?? throw ApiException.NotFound();
        await access.RequireOrganization(category.OrganizationId, true, cancellationToken);
        return category;
    }
}

public static class TaskCategoriesEndpoints
{
    public static void MapTaskCategoriesEndpoints(this IEndpointRouteBuilder app)
    {
        var byOrganization = app.MapGroup("/organizations/{id:guid}/task-categories").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<TaskCategoryDto>>> (Guid id, [AsParameters] PageQuery query, TaskCategoriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        byOrganization.MapPost("", async Task<Created<TaskCategoryDto>> (Guid id, NameRequest request, TaskCategoriesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var categories = app.MapGroup("/task-categories").RequireAuthorization();
        categories.MapPatch("/{id:guid}", async Task<Ok<TaskCategoryDto>> (Guid id, NameRequest request, TaskCategoriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        categories.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, TaskCategoriesService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
