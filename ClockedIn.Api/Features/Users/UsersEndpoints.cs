using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Users;

public static class UsersEndpoints
{
    public static void MapUsersEndpoints(this IEndpointRouteBuilder app)
    {
        var users = app.MapGroup("/users").RequireAuthorization();
        users.MapGet("", async Task<Ok<ListResponse<UserDto>>> ([AsParameters] PageQuery query, UsersService service, CancellationToken ct) =>
            TypedResults.Ok(await service.List(query, ct)));
        users.MapGet("/me", async Task<Ok<UserDto>> (CurrentUser current, UsersService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(current.Id, ct))).WithMetadata(new AllowPasswordChangeAttribute());
        users.MapPatch("/me", async Task<Ok<UserDto>> (UpdateUserRequest request, CurrentUser current, UsersService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(current.Id, request, fromMe: true, ct)))
            .WithMetadata(new AllowPasswordChangeAttribute());
        users.MapGet("/{id:guid}", async Task<Ok<UserDto>> (Guid id, UsersService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Get(id, ct)));
        users.MapPatch("/{id:guid}", async Task<Ok<UserDto>> (Guid id, UpdateUserRequest request, UsersService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Update(id, request, fromMe: false, ct)));
        users.MapDelete("/{id:guid}", async Task<NoContent> (Guid id, UsersService service, CancellationToken ct) =>
        {
            await service.Delete(id, ct);
            return TypedResults.NoContent();
        });
    }
}
