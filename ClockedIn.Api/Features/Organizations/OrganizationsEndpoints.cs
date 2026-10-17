using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Organizations;

public static class OrganizationsEndpoints
{
    public static void MapOrganizationsEndpoints(this IEndpointRouteBuilder app)
    {
        var organizations = app.MapGroup("/organizations").RequireAuthorization();
        organizations.MapGet("", async Task<Ok<ListResponse<OrganizationDto>>> ([AsParameters] PageQuery query, OrganizationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(query, ct)));
        organizations.MapPost("", async Task<Created<OrganizationDto>> (NameRequest request, OrganizationsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(request, ct)));
        organizations.MapGet("/{id:guid}", async Task<Ok<OrganizationDto>> (Guid id, OrganizationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        organizations.MapPatch("/{id:guid}", async Task<Ok<OrganizationDto>> (Guid id, UpdateOrganizationRequest request, OrganizationsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        organizations.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, OrganizationsService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
