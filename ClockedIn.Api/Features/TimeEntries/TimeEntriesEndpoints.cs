using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.TimeEntries;

public static class TimeEntriesEndpoints
{
    public static void MapTimeEntriesEndpoints(this IEndpointRouteBuilder app)
    {
        var byUser = app.MapGroup("/users/{id:guid}/time-entries").RequireAuthorization();
        byUser.MapGet("", async Task<Ok<ListResponse<TimeEntryDto>>> (Guid id, [AsParameters] TimeEntryFilter filter, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(id, filter, ct)));
        byUser.MapPost("", async Task<Created<TimeEntryDto>> (Guid id, CreateTimeEntryRequest request, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(id, request, ct)));

        var byOrganization = app.MapGroup("/organizations/{id:guid}/time-entries").RequireAuthorization();
        byOrganization.MapGet("", async Task<Ok<ListResponse<TimeEntryDto>>> (Guid id, [AsParameters] PageQuery query, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ListForOrganization(id, query, ct)));

        var entries = app.MapGroup("/time-entries").RequireAuthorization();
        entries.MapGet("/{id:guid}", async Task<Ok<TimeEntryDto>> (Guid id, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        entries.MapPatch("/{id:guid}", async Task<Ok<TimeEntryDto>> (Guid id, UpdateTimeEntryRequest request, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, ct)));
        entries.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, TimeEntriesService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });

        var clock = app.MapGroup("/time").RequireAuthorization();
        clock.MapPost("/clock-in", async Task<Created<TimeEntryDto>> (ClockInRequest request, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.ClockIn(request, ct)));
        clock.MapPost("/clock-out", async Task<Ok<TimeEntryDto>> (ClockOutRequest request, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Ok(await service.ClockOut(request, ct)));
        clock.MapPost("/duration", async Task<Created<TimeEntryDto>> (LogDurationRequest request, CurrentUser current, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(current.Id, request.Entry, ct)));
        clock.MapPost("/total", async Task<Created<TimeEntryDto>> (LogTotalRequest request, CurrentUser current, TimeEntriesService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.Create(current.Id, request.Entry, ct)));
    }
}
