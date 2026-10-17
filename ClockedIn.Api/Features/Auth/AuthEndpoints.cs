using ClockedIn.Api.Http;
using ClockedIn.Api.Security;
using Microsoft.AspNetCore.Http.HttpResults;

namespace ClockedIn.Api.Features.Auth;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth");
        auth.MapPost("/user", async Task<Created<SessionDto>> (SignUpRequest request, AuthService service, CancellationToken ct) =>
            TypedResults.Created((string?)null, await service.SignUp(request, ct)));
        auth.MapPost("/login", async Task<Ok<SessionDto>> (LogInRequest request, AuthService service, CancellationToken ct) =>
            TypedResults.Ok(await service.LogIn(request, ct)));
        auth.MapPost("/refresh", async Task<Ok<SessionDto>> (RefreshTokenRequest request, AuthService service, CancellationToken ct) =>
            TypedResults.Ok(await service.Refresh(request, ct)));
        auth.MapPost("/logout", async Task<Ok<OkResponse>> (RefreshTokenRequest request, CurrentUser current, AuthService service, CancellationToken ct) =>
        {
            await service.LogOut(current.Id, request, ct);
            return TypedResults.Ok(OkResponse.Instance);
        }).RequireAuthorization();
        auth.MapGet("/user/forgot-password", async Task<Ok<OkResponse>> (string? email, AuthService service, CancellationToken ct) =>
        {
            await service.RequestPasswordReset(email, ct);
            return TypedResults.Ok(OkResponse.Instance);
        });
        auth.MapPost("/user/forgot-password", async Task<Ok<OkResponse>> (ConfirmPasswordResetRequest request, AuthService service, CancellationToken ct) =>
        {
            await service.ConfirmPasswordReset(request, ct);
            return TypedResults.Ok(OkResponse.Instance);
        });
    }
}
