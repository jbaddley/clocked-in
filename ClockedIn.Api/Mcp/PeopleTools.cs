using System.ComponentModel;
using ClockedIn.Api.Features.Invitations;
using ClockedIn.Api.Features.Memberships;
using ClockedIn.Api.Http;
using ModelContextProtocol.Server;

namespace ClockedIn.Api.Mcp;

[McpServerToolType]
public sealed class PeopleTools(MembershipsService memberships, InvitationsService invitations)
{
    [McpServerTool, Description("List organization memberships.")]
    public Task<ListResponse<MembershipDto>> ListMembers(Guid organizationId, int? limit, int? offset, CancellationToken cancellationToken) =>
        McpCall.Run(() => memberships.ListOrganization(organizationId, new PageQuery(limit?.ToString(), offset?.ToString()), cancellationToken));

    [McpServerTool, Description("Create a membership (existing or new person). Pass JSON with email, role, firstName, lastName, and optional username, password, departmentIds.")]
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
}
