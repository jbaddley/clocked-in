using System.Text.Json.Nodes;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Users;

public sealed record ProfileDto(
    Guid Id,
    string FirstName,
    string LastName,
    string? DisplayName,
    string Timezone,
    string? Phone,
    string? ZipCode,
    string? Notes,
    string? MemberNumber,
    string? AvatarUrl,
    string? Description);

public sealed record UserDto(
    Guid Id,
    string Username,
    string Email,
    bool IsSuperAdmin,
    bool MustChangePassword,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    ProfileDto? Profile)
{
    public static UserDto From(User user, bool includePrivate = true) => new(
        user.Id,
        user.Username,
        user.Email,
        user.IsSuperAdmin,
        user.MustChangePassword,
        user.CreatedAt,
        user.UpdatedAt,
        user.Profile is not { } profile
            ? null
            : new ProfileDto(
                profile.Id,
                profile.FirstName,
                profile.LastName,
                profile.DisplayName,
                profile.Timezone,
                includePrivate ? profile.Phone : null,
                includePrivate ? profile.ZipCode : null,
                includePrivate ? profile.Notes : null,
                profile.MemberNumber,
                profile.AvatarUrl,
                profile.Description));
}

public sealed record UpdateUserRequest(
    Optional<string> Username,
    Optional<string> Email,
    Optional<string> Password,
    string? CurrentPassword,
    Optional<string> FirstName,
    Optional<string> LastName,
    Optional<string?> DisplayName,
    Optional<string> Timezone,
    Optional<string?> Phone,
    Optional<string?> ZipCode,
    Optional<string?> Notes,
    Optional<string?> AvatarUrl,
    Optional<string?> Description,
    Optional<bool> IsSuperAdmin)
{
    public static async ValueTask<UpdateUserRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateUserRequest Parse(JsonObject body)
    {
        var username = Optional.Read(body, "username", (b, k) => Fields.NormalizeUsername(Fields.RequiredString(b, k)));
        var email = Optional.Read(body, "email", (b, k) => Fields.NormalizeEmail(Fields.RequiredString(b, k)));
        var password = Optional.Read(body, "password", (b, k) => Fields.NormalizePassword(Fields.RequiredString(b, k)));
        string? currentPassword = null;
        if (password.HasValue)
        {
            currentPassword = Fields.OptionalString(body, "currentPassword");
            if (string.IsNullOrEmpty(currentPassword))
            {
                throw ApiException.Validation("currentPassword is required to change the password.");
            }
        }

        var firstName = Optional.Read(body, "firstName", (b, k) => Fields.PersonName(Fields.RequiredString(b, k), k));
        var lastName = Optional.Read(body, "lastName", (b, k) => Fields.PersonName(Fields.RequiredString(b, k), k));
        var displayName = Optional.Read(body, "displayName", (b, k) => Limited(b, k, 100, "displayName is required."));
        var timezone = Optional.Read(body, "timezone", (b, k) =>
        {
            var value = Fields.RequiredString(b, k).Trim();
            Fields.AssertTimezone(value);
            return value;
        });
        var phone = Optional.Read(body, "phone", (b, k) => Limited(b, k, 40, "phone is required."));
        var zipCode = Optional.Read(body, "zipCode", (b, k) => Limited(b, k, 20, "zipCode must be 20 characters or fewer."));
        var notes = Optional.Read(body, "notes", (b, k) => Limited(b, k, 2000, "notes must be 2000 characters or fewer."));
        var avatarUrl = Optional.Read(body, "avatarUrl", (b, k) => Limited(b, k, 2000, "avatarUrl must be a URL."));
        var description = Optional.Read(body, "description", (b, k) => Limited(b, k, 8000, "description must be 8000 characters or fewer."));
        var isSuperAdmin = Optional.Read(body, "isSuperAdmin", Fields.RequiredBool);
        return new UpdateUserRequest(
            username,
            email,
            password,
            currentPassword,
            firstName,
            lastName,
            displayName,
            timezone,
            phone,
            zipCode,
            notes,
            avatarUrl,
            description,
            isSuperAdmin);
    }

    internal static string? Limited(JsonObject body, string key, int maxLength, string message)
    {
        var value = Fields.CleanOptional(Fields.OptionalString(body, key));
        if (value is not null && value.Length > maxLength)
        {
            throw ApiException.Validation(message);
        }

        return value;
    }
}
