using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Projects;

public static class ProjectsEndpoints
{
    public static void MapProjectsEndpoints(this IEndpointRouteBuilder app)
    {
        var byOrganization = app.MapGroup("/organizations/{id:guid}/projects").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<ProjectDto>>> (Guid id, [AsParameters] PageQuery query, ProjectsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        byOrganization.MapPost("", async Task<Created<ProjectDto>> (Guid id, CreateProjectRequest request, ProjectsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var projects = app.MapGroup("/projects").RequireAuthorization();
        projects.MapGet("/{id:guid}", async Task<Ok<ProjectDto>> (Guid id, ProjectsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        projects.MapPatch("/{id:guid}", async Task<Ok<ProjectDto>> (Guid id, UpdateProjectRequest request, ProjectsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        projects.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, ProjectsService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
