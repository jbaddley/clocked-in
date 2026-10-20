import { createMcpHandler } from "mcp-handler";
import { registerCatalogTools } from "@/lib/mcp/tools/catalog";
import { registerOrganizationTools } from "@/lib/mcp/tools/organizations";
import { registerPeopleTools } from "@/lib/mcp/tools/people";
import { registerProjectTools } from "@/lib/mcp/tools/projects";
import { registerReportTools } from "@/lib/mcp/tools/reports";
import { registerTimeTools } from "@/lib/mcp/tools/time";

export const mcpHandler = createMcpHandler(
  (server) => {
    registerOrganizationTools(server);
    registerProjectTools(server);
    registerPeopleTools(server);
    registerReportTools(server);
    registerTimeTools(server);
    registerCatalogTools(server);
  },
  { serverInfo: { name: "clocked-in", version: "0.1.0" } },
);
