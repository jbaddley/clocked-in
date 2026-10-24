using System.Text.Json.Nodes;
using ClockedIn.Api.Entities;
using ClockedIn.Api.Http;

namespace ClockedIn.Api.Features.Connections;

public sealed record ConnectionPersonDto(
    Guid Id,
    string Username,
    string Email,
    string? FirstName,
    string? LastName,
    string? DisplayName)
{
    public static ConnectionPersonDto From(User user) => new(
        user.Id,
        user.Username,
        user.Email,
        user.Profile?.FirstName,
        user.Profile?.LastName,
        user.Profile?.DisplayName);
}

public sealed record ConnectionDto(
    Guid Id,
    Guid OrganizationId,
    Guid UserAId,
    Guid UserBId,
    string Relationship,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    ConnectionPersonDto UserA,
    ConnectionPersonDto UserB)
{
    public static ConnectionDto From(MemberConnection connection) => new(
        connection.Id,
        connection.OrganizationId,
        connection.UserAId,
        connection.UserBId,
        connection.Relationship.ToString(),
        connection.CreatedByUserId,
        connection.CreatedAt,
        ConnectionPersonDto.From(connection.UserA),
        ConnectionPersonDto.From(connection.UserB));
}

public sealed record CreateConnectionRequest(Guid UserId, Guid ConnectedUserId, MemberRelationship Relationship)
{
    public static async ValueTask<CreateConnectionRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static CreateConnectionRequest Parse(JsonObject body) => new(
        Fields.RequiredGuid(body, "userId"),
        Fields.RequiredGuid(body, "connectedUserId"),
        MemberConnectionRules.Parse(Fields.RequiredString(body, "relationship")));
}

public sealed record UpdateConnectionRequest(Guid UserId, MemberRelationship Relationship)
{
    public static async ValueTask<UpdateConnectionRequest?> BindAsync(HttpContext context) => Parse(await Body.Read(context));

    public static UpdateConnectionRequest Parse(JsonObject body) => new(
        Fields.RequiredGuid(body, "userId"),
        MemberConnectionRules.Parse(Fields.RequiredString(body, "relationship")));
}
