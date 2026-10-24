using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Connections;

public static class ConnectionsEndpoints
{
    public static void MapConnectionsEndpoints(this IEndpointRouteBuilder app)
    {
        var connections = app.MapGroup("/organizations/{id:guid}/connections").RequireAuthorization();
        connections.MapGet("", async Task<Ok<ListResponse<ConnectionDto>>> (Guid id, [AsParameters] PageQuery query, ConnectionsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, query, ct)));
        connections.MapPost("", async Task<Created<ConnectionDto>> (Guid id, CreateConnectionRequest request, ConnectionsService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));
        connections.MapPatch("/{connectionId:guid}", async Task<Ok<ConnectionDto>> (Guid id, Guid connectionId, UpdateConnectionRequest request, ConnectionsService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, connectionId, request, ct)));
        connections.MapDelete("/{connectionId:guid}", async Task<NoContent> (Guid id, Guid connectionId, ConnectionsService service, CancellationToken ct) =>
        {
            await service.Delete(id, connectionId, ct);
            return TypedResults.NoContent();
        });
    }
}
