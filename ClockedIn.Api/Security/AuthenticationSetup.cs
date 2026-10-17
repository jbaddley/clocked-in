using System.IdentityModel.Tokens.Jwt;
using ClockedIn.Api.Configuration;
using ClockedIn.Api.Data;
using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ClockedIn.Api.Security;

public static class AuthenticationSetup
{
    private const string FailureMessageKey = "auth.failure";
    private const string UnknownUserMessage = "This token is not valid for this server.";

    public static IServiceCollection AddClockedInAuthentication(this IServiceCollection services)
    {
        services.AddScoped<CurrentUser>();
        services.AddSingleton<TokenIssuer>();
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((bearer, jwt) =>
            {
                bearer.MapInboundClaims = false;
                bearer.TokenValidationParameters = TokenIssuer.ValidationParameters(jwt.Value);
                bearer.Events = new JwtBearerEvents
                {
                    OnTokenValidated = LoadCurrentUser,
                    OnChallenge = WriteUnauthorized,
                };
            });
        services.AddAuthorization();
        return services;
    }

    private static async Task LoadCurrentUser(TokenValidatedContext context)
    {
        var subject = context.Principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (!Guid.TryParse(subject, out var userId))
        {
            context.Fail("The token has no subject.");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<ClockedInDbContext>();
        var user = await db.UsersWithProfile().FirstOrDefaultAsync(user => user.Id == userId, context.HttpContext.RequestAborted);
        if (user is null)
        {
            context.HttpContext.Items[FailureMessageKey] = UnknownUserMessage;
            context.Fail(UnknownUserMessage);
            return;
        }

        context.HttpContext.RequestServices.GetRequiredService<CurrentUser>().Set(user);
    }

    private static async Task WriteUnauthorized(JwtBearerChallengeContext context)
    {
        context.HandleResponse();
        var message = context.HttpContext.Items[FailureMessageKey] as string ?? "Authentication is required.";
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new ErrorResponse("unauthorized", message), context.HttpContext.RequestAborted);
    }
}
