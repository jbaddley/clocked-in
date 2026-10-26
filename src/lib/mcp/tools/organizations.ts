import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getOrganization, listOrganizations, parseUpdateOrganization, updateOrganization } from "@/lib/api/features/organizations";
import { jsonBody, query } from "@/lib/mcp/call";
import { mcpAccess } from "@/lib/mcp/context";
import { guid, tool } from "@/lib/mcp/tool";

const page = { limit: z.number().int().nullable(), offset: z.number().int().nullable() };

export function registerOrganizationTools(server: McpServer) {
  tool(server, "list_organizations", "List organizations the caller can access.", page, ({ limit, offset }) =>
    listOrganizations(mcpAccess(), query({ limit, offset })),
  );

  tool(server, "get_organization", "Get an organization by id.", { organizationId: guid }, ({ organizationId }) =>
    getOrganization(mcpAccess(), organizationId),
  );

  tool(
    server,
    "update_organization",
    "Update an organization. Pass a JSON object with fields such as name, description, websiteUrl, volunteerHourlyRate, defaultRateType, preferences, and themeId.",
    { organizationId: guid, body: z.string() },
    ({ organizationId, body }) => updateOrganization(mcpAccess(), organizationId, parseUpdateOrganization(jsonBody(body))),
  );
}
