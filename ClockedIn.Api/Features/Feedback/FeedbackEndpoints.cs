using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Feedback;

public static class FeedbackEndpoints
{
    public static void MapFeedbackEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/feedback").RequireAuthorization();
        group.MapGet("", async Task<Ok<ListResponse<FeedbackDto>>> ([AsParameters] FeedbackFilter filter, FeedbackService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(filter, ct)));
        group.MapPost("", async Task<Created<FeedbackDto>> (CreateFeedbackRequest request, FeedbackService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(request, ct)));
        group.MapGet("/{id:guid}", async Task<Ok<FeedbackDto>> (Guid id, FeedbackService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        group.MapPatch("/{id:guid}", async Task<Ok<FeedbackDto>> (Guid id, UpdateFeedbackRequest request, FeedbackService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
    }
}
