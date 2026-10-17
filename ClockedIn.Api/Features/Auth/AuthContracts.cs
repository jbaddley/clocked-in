using System.Text.Json.Nodes;
using ClockedIn.Api.Features.Users;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Auth;

public sealed record SessionDto(string AccessToken, string RefreshToken, DateTime ExpiresAt, UserDto User);

public sealed record SignUpRequest(
    string Username,
    string Email,
    string Password,
    string FirstName,
    string LastName,
    string? DisplayName,
    string Timezone,
    string? Phone)
{
    public static async ValueTask<SignUpRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static SignUpRequest Parse(JsonObject body)
    {
        var username = Fields.NormalizeUsername(Fields.RequiredString(body, "username"));
        var email = Fields.NormalizeEmail(Fields.RequiredString(body, "email"));
        var password = Fields.NormalizePassword(Fields.RequiredString(body, "password"));
        var firstName = Fields.PersonName(Fields.RequiredString(body, "firstName"), "firstName");
        var lastName = Fields.PersonName(Fields.RequiredString(body, "lastName"), "lastName");
        var displayName = Fields.Has(body, "displayName")
            ? UpdateUserRequest.Limited(body, "displayName", 100, "displayName is required.")
            : null;
        var zone = "UTC";
        var timezone = Fields.OptionalString(body, "timezone");
        if (!string.IsNullOrWhiteSpace(timezone))
        {
            zone = timezone.Trim();
            Fields.AssertTimezone(zone);
        }

        var phone = Fields.Has(body, "phone") ? UpdateUserRequest.Limited(body, "phone", 40, "phone is required.") : null;
        return new SignUpRequest(username, email, password, firstName, lastName, displayName, zone, phone);
    }
}

public sealed record LogInRequest(string Username, string Password)
{
    public static async ValueTask<LogInRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        return new LogInRequest(
            Fields.NormalizeUsername(Fields.RequiredString(body, "username")),
            Fields.RequiredString(body, "password"));
    }
}

public sealed record RefreshTokenRequest(string RefreshToken)
{
    public static async ValueTask<RefreshTokenRequest?> BindAsync(HttpContext context) =>
        new(Fields.RequiredString(await Body.Read(context), "refreshToken"));
}

public sealed record ConfirmPasswordResetRequest(string Email, string Code, string Password)
{
    public static async ValueTask<ConfirmPasswordResetRequest?> BindAsync(HttpContext context)
    {
        var body = await Body.Read(context);
        return new ConfirmPasswordResetRequest(
            Fields.NormalizeEmail(Fields.RequiredString(body, "email")),
            Fields.RequiredString(body, "code"),
            Fields.NormalizePassword(Fields.RequiredString(body, "password")));
    }
}
