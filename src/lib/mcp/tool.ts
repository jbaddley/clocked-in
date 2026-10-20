import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { mcpCall } from "@/lib/mcp/call";

export const guid = z.uuid();

export function tool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: Shape,
  run: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>,
) {
  server.registerTool(name, { description, inputSchema: z.object(shape) }, (args) => mcpCall(() => run(args)));
}
