import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { parseCreateInvitation, listOrganizationInvitations, createOrganizationInvitation, revokeOrganizationInvitation } from "@/lib/api/features/invitations";
import {
  createOrgMembership,
  deleteOrgMembership,
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
    "Create a membership (existing or new person). Pass JSON with email, role, firstName, lastName, and optional username, password, departmentIds.",
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
}
