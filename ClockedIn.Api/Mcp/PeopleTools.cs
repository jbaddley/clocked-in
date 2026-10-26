using System.ComponentModel;
using ClockedIn.Api.Features.Connections;
using ClockedIn.Api.Features.Invitations;
using ClockedIn.Api.Features.Memberships;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class PeopleTools(MembershipsService memberships, InvitationsService invitations, ConnectionsService connections)
{
    [McpServerTool, Description("List organization memberships.")]
    public Task<ListResponse<MembershipDto>> ListMembers(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => memberships.ListOrganization(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Create a membership (existing or new person). Pass JSON with email, role, firstName, lastName, and optional username, password, departmentIds, avatarUrl, description, orgUserTitle, orgUserDescription, and emailUser. emailUser emails a new account its username and temporary password. When Allow volunteers to add volunteers is on, a volunteer can create another volunteer and must include relationship.")]
    public Task<MembershipDto> CreateMember(Guid organizationId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => memberships.CreateOrganization(organizationId, CreateOrgMembershipRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Update an organization membership.")]
    public Task<MembershipDto> UpdateMembership(Guid organizationId, Guid membershipId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => memberships.UpdateOrganization(organizationId, membershipId, UpdateOrgMembershipRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Remove an organization membership.")]
    public Task<string> DeleteMembership(Guid organizationId, Guid membershipId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await memberships.DeleteOrganization(organizationId, membershipId, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("Remove organization memberships. membershipIds is 1 to 100 organization membership ids.")]
    public Task<string> DeleteMemberships(Guid organizationId, Guid[] membershipIds, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await memberships.DeleteOrganizations(organizationId, membershipIds, cancellationToken);
            return "deleted";
        });

    [McpServerTool, Description("List pending organization invitations.")]
    public Task<ListResponse<InvitationDto>> ListInvitations(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => invitations.ListForOrganization(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Invite someone to the organization. Role is ADMIN, MEMBER, or VOLUNTEER.")]
    public Task<InvitationDto> CreateInvitation(Guid organizationId, string email, string role, CancellationToken cancellationToken) =>
        McpCall.Run(() => invitations.CreateForOrganization(
            organizationId,
            new CreateInvitationRequest(Fields.NormalizeEmail(email), Fields.NormalizeRole(role)),
            cancellationToken));

    [McpServerTool, Description("Revoke an organization invitation.")]
    public Task<InvitationDto> RevokeInvitation(Guid organizationId, Guid invitationId, CancellationToken cancellationToken) =>
        McpCall.Run(() => invitations.RevokeForOrganization(organizationId, invitationId, cancellationToken));

    [McpServerTool, Description("List member connections. Admins see every connection. Other members see only their own. relationship is how user B relates to user A.")]
    public Task<ListResponse<ConnectionDto>> ListConnections(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => connections.List(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Connect two active members. relationship is how connectedUserId relates to userId. Organization admin only.")]
    public Task<ConnectionDto> CreateConnection(Guid organizationId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => connections.Create(organizationId, CreateConnectionRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Change a connection. Pass JSON with userId and relationship from that person's point of view. Organization admin only.")]
    public Task<ConnectionDto> UpdateConnection(Guid organizationId, Guid connectionId, string body, CancellationToken cancellationToken) =>
        McpCall.Run(() => connections.Update(organizationId, connectionId, UpdateConnectionRequest.Parse(McpCall.Object(body)), cancellationToken));

    [McpServerTool, Description("Remove a member connection. Organization admin only.")]
    public Task<string> DeleteConnection(Guid organizationId, Guid connectionId, CancellationToken cancellationToken) =>
        McpCall.Run(async () =>
        {
            await connections.Delete(organizationId, connectionId, cancellationToken);
            return "deleted";
        });
}
