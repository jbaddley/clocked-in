namespace ClockedIn.Api.Http;

public sealed class ApiException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;

    public static ApiException Validation(string message) => new(400, "validation_error", message);

    public static ApiException Unauthorized(string message = "Authentication is required.") =>
        new(401, "unauthorized", message);

    public static ApiException Forbidden() => new(403, "forbidden", "Forbidden.");

    public static ApiException NotFound() => new(404, "not_found", "Not found.");

    public static ApiException Conflict(string message) => new(409, "conflict", message);
}
