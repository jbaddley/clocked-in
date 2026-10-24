import type { McpServer } from "@modelcontextprotocol/server";
import { beginMcpCatalogRecording, type McpToolMeta } from "@/lib/mcp/tool";
import { registerCatalogTools } from "@/lib/mcp/tools/catalog";
import { registerOrganizationTools } from "@/lib/mcp/tools/organizations";
import { registerPeopleTools } from "@/lib/mcp/tools/people";
import { registerProjectTools } from "@/lib/mcp/tools/projects";
import { registerReportTools } from "@/lib/mcp/tools/reports";
import { registerTimeTools } from "@/lib/mcp/tools/time";

const groups: { group: string; register: (server: McpServer) => void }[] = [
  { group: "Organizations", register: registerOrganizationTools },
  { group: "Projects", register: registerProjectTools },
  { group: "People", register: registerPeopleTools },
  { group: "Reports", register: registerReportTools },
  { group: "Time", register: registerTimeTools },
  { group: "Catalog", register: registerCatalogTools },
];

export type McpToolGroup = { group: string; tools: McpToolMeta[] };

export function loadMcpCatalog(): McpToolGroup[] {
  const server = { registerTool() {} } as unknown as McpServer;
  return groups.map(({ group, register }) => {
    const session = beginMcpCatalogRecording();
    try {
      register(server);
      return { group, tools: session.take() };
    } catch (error) {
      session.take();
      throw error;
    }
  });
}
