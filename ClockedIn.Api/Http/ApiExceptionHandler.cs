using Microsoft.AspNetCore.Diagnostics;

namespace ClockedIn.Api.Http;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, error) = exception is ApiException api
            ? (api.Status, new ErrorResponse(api.Code, api.Message))
            : (StatusCodes.Status500InternalServerError, new ErrorResponse("server_error", "Something went wrong."));
        if (exception is not ApiException)
        {
            logger.LogError(exception, "Unhandled API error");
        }

        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(error, cancellationToken);
        return true;
    }
}
