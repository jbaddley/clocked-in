import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { mcpCall } from "@/lib/mcp/call";

export const guid = z.uuid();

export type McpToolParam = { name: string; type: string };
export type McpToolMeta = { name: string; description: string; params: McpToolParam[] };

let recording: McpToolMeta[] | null = null;

export function beginMcpCatalogRecording() {
  recording = [];
  return {
    take() {
      const tools = recording ?? [];
      recording = null;
      return tools;
    },
  };
}

type ZodDef = {
  type: string;
  format?: string;
  innerType?: z.ZodType;
  element?: z.ZodType;
  checks?: { def?: { format?: string } }[];
};

function describeZod(schema: z.ZodType): string {
  const def = schema.def as ZodDef;
  if (def.type === "nullable" && def.innerType) return `${describeZod(def.innerType)} | null`;
  if (def.type === "optional" && def.innerType) return `${describeZod(def.innerType)}?`;
  if (def.type === "array") return `${def.element ? describeZod(def.element) : "unknown"}[]`;
  if (def.type === "string" && def.format === "uuid") return "uuid";
  if (def.type === "number") {
    return def.checks?.some((check) => check.def?.format === "safeint") ? "integer" : "number";
  }
  return def.type;
}

export function tool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  description: string,
  shape: Shape,
  run: (args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>,
) {
  recording?.push({
    name,
    description,
    params: Object.entries(shape).map(([paramName, schema]) => ({
      name: paramName,
      type: describeZod(schema as z.ZodType),
    })),
  });
  server.registerTool(name, { description, inputSchema: z.object(shape) }, (args) => mcpCall(() => run(args)));
}
