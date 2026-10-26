import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { parseCreateInvitation, listOrganizationInvitations, createOrganizationInvitation, revokeOrganizationInvitation } from "@/lib/api/features/invitations";
import {
  createConnection,
  deleteConnection,
  listConnections,
  parseCreateConnection,
  parseUpdateConnection,
  updateConnection,
} from "@/lib/api/features/connections";
import {
  createOrgMembership,
  deleteOrgMembership,
  deleteOrgMemberships,
  listOrgMemberships,
  parseCreateOrgMembership,
  parseUpdateOrgMembership,
  updateOrgMembership,
} from "@/lib/api/features/memberships";
import { jsonBody, query } from "@/lib/mcp/call";
import { mcpAccess } from "@/lib/mcp/context";
import { guid, tool } from "@/lib/mcp/tool";

const page = { limit: z.number().int().nullable(), offset: z.number().int().nullable() };

export function registerPeopleTools(server: McpServer) {
  tool(server, "list_members", "List organization memberships.", { organizationId: guid, ...page }, ({ organizationId, limit, offset }) =>
    listOrgMemberships(mcpAccess(), organizationId, query({ limit, offset })),
  );

  tool(
    server,
    "create_member",
    "Create a membership (existing or new person). Pass JSON with email, role, firstName, lastName, and optional username, password, departmentIds, avatarUrl, description, orgUserTitle, orgUserDescription, and emailUser. emailUser emails a new account its username and temporary password. When Allow volunteers to add volunteers is on, a volunteer can create another volunteer and must include relationship.",
    { organizationId: guid, body: z.string() },
    ({ organizationId, body }) => createOrgMembership(mcpAccess(), organizationId, parseCreateOrgMembership(jsonBody(body))),
  );

  tool(
    server,
    "update_membership",
    "Update an organization membership.",
    { organizationId: guid, membershipId: guid, body: z.string() },
    ({ organizationId, membershipId, body }) =>
      updateOrgMembership(mcpAccess(), organizationId, membershipId, parseUpdateOrgMembership(jsonBody(body))),
  );

  tool(
    server,
    "delete_membership",
    "Remove an organization membership.",
    { organizationId: guid, membershipId: guid },
    async ({ organizationId, membershipId }) => {
      await deleteOrgMembership(mcpAccess(), organizationId, membershipId);
      return "deleted";
    },
  );

  tool(
    server,
    "delete_memberships",
    "Remove organization memberships. membershipIds is 1 to 100 organization membership ids.",
    { organizationId: guid, membershipIds: z.array(guid) },
    async ({ organizationId, membershipIds }) => {
      await deleteOrgMemberships(mcpAccess(), organizationId, membershipIds);
      return "deleted";
    },
  );

  tool(
    server,
    "list_invitations",
    "List pending organization invitations.",
    { organizationId: guid, ...page },
    ({ organizationId, limit, offset }) => listOrganizationInvitations(mcpAccess(), organizationId, query({ limit, offset })),
  );

  tool(
    server,
    "create_invitation",
    "Invite someone to the organization. Role is ADMIN, MEMBER, or VOLUNTEER.",
    { organizationId: guid, email: z.string(), role: z.string() },
    ({ organizationId, email, role }) =>
      createOrganizationInvitation(mcpAccess(), organizationId, parseCreateInvitation({ email, role })),
  );

  tool(
    server,
    "revoke_invitation",
    "Revoke an organization invitation.",
    { organizationId: guid, invitationId: guid },
    ({ organizationId, invitationId }) => revokeOrganizationInvitation(mcpAccess(), organizationId, invitationId),
  );

  tool(
    server,
    "list_connections",
    "List member connections. Admins see every connection. Other members see only their own. relationship is how user B relates to user A.",
    { organizationId: guid, ...page },
    ({ organizationId, limit, offset }) => listConnections(mcpAccess(), organizationId, query({ limit, offset })),
  );

  tool(
    server,
    "create_connection",
    "Connect two active members. JSON body has userId, connectedUserId, and relationship (how connectedUserId relates to userId). Organization admin only.",
    { organizationId: guid, body: z.string() },
    ({ organizationId, body }) => createConnection(mcpAccess(), organizationId, parseCreateConnection(jsonBody(body))),
  );

  tool(
    server,
    "update_connection",
    "Change a connection. JSON body has userId and relationship from that person's point of view. Organization admin only.",
    { organizationId: guid, connectionId: guid, body: z.string() },
    ({ organizationId, connectionId, body }) =>
      updateConnection(mcpAccess(), organizationId, connectionId, parseUpdateConnection(jsonBody(body))),
  );

  tool(
    server,
    "delete_connection",
    "Remove a member connection. Organization admin only.",
    { organizationId: guid, connectionId: guid },
    async ({ organizationId, connectionId }) => {
      await deleteConnection(mcpAccess(), organizationId, connectionId);
      return "deleted";
    },
  );
}
