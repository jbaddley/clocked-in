using ClockedIn.Api.Http;
using Microsoft.AspNetCore.Authorization;

namespace ClockedIn.Api.Security;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method | AttributeTargets.Delegate)]
public sealed class AllowPasswordChangeAttribute : Attribute;

public sealed class RequirePasswordChangeMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, CurrentUser current)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<IAuthorizeData>() is not null
            && endpoint.Metadata.GetMetadata<AllowPasswordChangeAttribute>() is null
            && current.UserOrNull is { MustChangePassword: true })
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(
                new ErrorResponse("password_change_required", "You must change your password before continuing."));
            return;
        }

        await next(context);
    }
}
