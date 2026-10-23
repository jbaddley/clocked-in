using System.Text.Json.Nodes;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Features.Users;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Memberships;

public sealed record RoleDto(Guid Id, string Code, string Name)
{
    public static RoleDto From(Role role) => new(role.Id, role.Code.ToString(), role.Name);
}

public sealed record MemberUserDto(
    Guid Id,
    string Username,
    string Email,
    string? FirstName,
    string? LastName,
    string? DisplayName)
{
    public static MemberUserDto From(User user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.Profile?.FirstName,
        user.Profile?.LastName,
        user.Profile?.DisplayName);
}

public sealed record MembershipDto(
    Guid Id,
    Guid UserId,
    Guid OrganizationId,
    Guid? DepartmentId,
    RoleDto Role,
    DateTime JoinedAt,
    string? RateType,
    decimal? ProfessionalBillingRate,
    bool? IsActive,
    Guid? PrimaryDepartmentId,
    Guid[] DepartmentIds,
    string? OrgUserTitle,
    string? OrgUserDescription,
    MemberUserDto User)
{
    public static MembershipDto From(OrganizationMembership membership, IEnumerable<Guid> departmentIds) => new(
        membership.Id,
        membership.UserId,
        membership.OrganizationId,
        null,
        RoleDto.From(membership.Role),
        membership.JoinedAt,
        membership.RateType.ToString(),
        membership.ProfessionalBillingRate,
        membership.IsActive,
        membership.PrimaryDepartmentId,
        departmentIds.Order().ToArray(),
        membership.OrgUserTitle,
        membership.OrgUserDescription,
        MemberUserDto.From(membership.User));

    public static MembershipDto From(DepartmentMembership membership, Guid organizationId) => new(
        membership.Id,
        membership.UserId,
        organizationId,
        membership.DepartmentId,
        RoleDto.From(membership.Role),
        membership.JoinedAt,
        null,
        null,
        null,
        null,
        [membership.DepartmentId],
        null,
        null,
        MemberUserDto.From(membership.User));
}

public sealed record CreateOrgMembershipRequest(
    string Email,
    string? Username,
    string? Password,
    string FirstName,
    string LastName,
    string? DisplayName,
    string Timezone,
    string? Phone,
    string? ZipCode,
    string? Notes,
    string? AvatarUrl,
    string? Description,
    string? OrgUserTitle,
    string? OrgUserDescription,
    RoleCode Role,
    List<Guid> DepartmentIds)
{
    public static async ValueTask<CreateOrgMembershipRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreateOrgMembershipRequest Parse(JsonObject body)
    {
        var email = Fields.NormalizeEmail(Fields.RequiredString(body, "email"));
        var username = Fields.Has(body, "username") ? Fields.NormalizeUsername(Fields.RequiredString(body, "username")) : null;
        var password = Fields.Has(body, "password") ? Fields.NormalizePassword(Fields.RequiredString(body, "password")) : null;
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
        var zipCode = Fields.Has(body, "zipCode") ? UpdateUserRequest.Limited(body, "zipCode", 20, "zipCode must be 20 characters or fewer.") : null;
        var notes = Fields.Has(body, "notes") ? UpdateUserRequest.Limited(body, "notes", 2000, "notes must be 2000 characters or fewer.") : null;
        var avatarUrl = Fields.Has(body, "avatarUrl") ? UpdateUserRequest.Limited(body, "avatarUrl", 2000, "avatarUrl must be a URL.") : null;
        var description = Fields.Has(body, "description") ? UpdateUserRequest.Limited(body, "description", 8000, "description must be 8000 characters or fewer.") : null;
        var orgUserTitle = Fields.Has(body, "orgUserTitle") ? UpdateUserRequest.Limited(body, "orgUserTitle", 100, "orgUserTitle must be 100 characters or fewer.") : null;
        var orgUserDescription = Fields.Has(body, "orgUserDescription")
            ? UpdateUserRequest.Limited(body, "orgUserDescription", 8000, "orgUserDescription must be 8000 characters or fewer.")
            : null;
        var role = Fields.NormalizeRole(Fields.RequiredString(body, "role"));
        var departmentIds = Fields.Ids(body, "departmentIds", optional: true);
        return new CreateOrgMembershipRequest(
            email, username, password, firstName, lastName, displayName, zone, phone, zipCode, notes,
            avatarUrl, description, orgUserTitle, orgUserDescription, role, departmentIds);
    }
}

public sealed record UpdateOrgMembershipRequest(
    Optional<RoleCode> Role,
    Optional<RateType> RateType,
    Optional<decimal?> ProfessionalBillingRate,
    Optional<bool> IsActive,
    Optional<Guid?> PrimaryDepartmentId,
    Optional<List<Guid>> DepartmentIds,
    Optional<string> FirstName,
    Optional<string> LastName,
    Optional<string?> DisplayName,
    Optional<string> Timezone,
    Optional<string?> Phone,
    Optional<string?> ZipCode,
    Optional<string?> Notes,
    Optional<string?> AvatarUrl,
    Optional<string?> Description,
    Optional<string?> OrgUserTitle,
    Optional<string?> OrgUserDescription,
    Optional<string> Email)
{
    public static async ValueTask<UpdateOrgMembershipRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateOrgMembershipRequest Parse(JsonObject body)
    {
        var request = new UpdateOrgMembershipRequest(
            Optional.Read(body, "role", (b, k) => Fields.NormalizeRole(Fields.RequiredString(b, k))),
            Optional.Read(body, "rateType", (b, k) => Fields.NormalizeRateType(Fields.RequiredString(b, k))),
            Optional.Read(body, "professionalBillingRate", (b, k) => Fields.OptionalDecimal(b, k) is decimal rate ? Fields.RoundMoney(rate) : (decimal?)null),
            Optional.Read(body, "isActive", Fields.RequiredBool),
            Optional.Read(body, "primaryDepartmentId", Fields.OptionalGuid),
            Optional.Read(body, "departmentIds", (b, k) => Fields.Ids(b, k, optional: false)),
            Optional.Read(body, "firstName", (b, k) => Fields.PersonName(Fields.RequiredString(b, k), k)),
            Optional.Read(body, "lastName", (b, k) => Fields.PersonName(Fields.RequiredString(b, k), k)),
            Optional.Read(body, "displayName", (b, k) => UpdateUserRequest.Limited(b, k, 100, "displayName is required.")),
            Optional.Read(body, "timezone", (b, k) =>
            {
                var value = Fields.RequiredString(b, k).Trim();
                Fields.AssertTimezone(value);
                return value;
            }),
            Optional.Read(body, "phone", (b, k) => UpdateUserRequest.Limited(b, k, 40, "phone is required.")),
            Optional.Read(body, "zipCode", (b, k) => UpdateUserRequest.Limited(b, k, 20, "zipCode must be 20 characters or fewer.")),
            Optional.Read(body, "notes", (b, k) => UpdateUserRequest.Limited(b, k, 2000, "notes must be 2000 characters or fewer.")),
            Optional.Read(body, "avatarUrl", (b, k) => UpdateUserRequest.Limited(b, k, 2000, "avatarUrl must be a URL.")),
            Optional.Read(body, "description", (b, k) => UpdateUserRequest.Limited(b, k, 8000, "description must be 8000 characters or fewer.")),
            Optional.Read(body, "orgUserTitle", (b, k) => UpdateUserRequest.Limited(b, k, 100, "orgUserTitle must be 100 characters or fewer.")),
            Optional.Read(body, "orgUserDescription", (b, k) => UpdateUserRequest.Limited(b, k, 8000, "orgUserDescription must be 8000 characters or fewer.")),
            Optional.Read(body, "email", (b, k) => Fields.NormalizeEmail(Fields.RequiredString(b, k))));
        if (!request.Role.HasValue
            && !request.RateType.HasValue
            && !request.ProfessionalBillingRate.HasValue
            && !request.IsActive.HasValue
            && !request.PrimaryDepartmentId.HasValue
            && !request.DepartmentIds.HasValue
            && !request.FirstName.HasValue
            && !request.LastName.HasValue
            && !request.DisplayName.HasValue
            && !request.Timezone.HasValue
            && !request.Phone.HasValue
            && !request.ZipCode.HasValue
            && !request.Notes.HasValue
            && !request.AvatarUrl.HasValue
            && !request.Description.HasValue
            && !request.OrgUserTitle.HasValue
            && !request.OrgUserDescription.HasValue
            && !request.Email.HasValue)
        {
            throw ApiException.Validation("Provide at least one field to update.");
        }

        return request;
    }
}

public sealed record DeleteOrgMembershipsRequest(List<Guid> MembershipIds)
{
    public static async ValueTask<DeleteOrgMembershipsRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static DeleteOrgMembershipsRequest Parse(JsonObject body) =>
        new(Fields.Ids(body, "membershipIds", optional: false));
}

public sealed record UpdateDepartmentMembershipRequest(RoleCode Role)
{
    public static async ValueTask<UpdateDepartmentMembershipRequest?> BindAsync(HttpContext context) =>
        new(Fields.NormalizeRole(Fields.RequiredString(await Body.Read(context), "role")));
}
