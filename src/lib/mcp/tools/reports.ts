import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { csv, report, summaryCsv } from "@/lib/api/features/reports";
import { query } from "@/lib/mcp/call";
import { mcpAccess } from "@/lib/mcp/context";
import { guid, tool } from "@/lib/mcp/tool";

const filters = {
  departmentId: z.string().nullable(),
  taskCategoryId: z.string().nullable(),
  projectId: z.string().nullable(),
  userId: z.string().nullable(),
  from: z.string().nullable(),
  to: z.string().nullable(),
};

function filterQuery(args: {
  departmentId: string | null;
  taskCategoryId: string | null;
  projectId: string | null;
  userId: string | null;
  from: string | null;
  to: string | null;
}) {
  return query(args);
}

export function registerReportTools(server: McpServer) {
  tool(
    server,
    "get_report",
    "Get volunteer and collective report aggregates for an organization. Optional departmentId, taskCategoryId, projectId, userId, from, to.",
    { organizationId: guid, ...filters },
    (args) => report(mcpAccess(), args.organizationId, filterQuery(args)),
  );

  tool(
    server,
    "export_time_entries_csv",
    "Export time-entry CSV for an organization. Same optional filters as get_report.",
    { organizationId: guid, ...filters },
    async (args) => (await csv(mcpAccess(), args.organizationId, filterQuery(args))).text(),
  );

  tool(
    server,
    "export_summary_csv",
    "Export the summary CSV for an organization. Same optional filters as get_report.",
    { organizationId: guid, ...filters },
    async (args) => (await summaryCsv(mcpAccess(), args.organizationId, filterQuery(args))).text(),
  );
}
