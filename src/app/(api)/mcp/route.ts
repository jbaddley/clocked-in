import { connection } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { json } from "@/lib/api/json";
import { authenticateMcp } from "@/lib/mcp/auth";
import { withMcpAccess } from "@/lib/mcp/context";
import { mcpHandler } from "@/lib/mcp/handler";

export const maxDuration = 60;

async function mcp(request: Request) {
  await connection();
  try {
    const access = await authenticateMcp(request);
    return await withMcpAccess(access, () => mcpHandler(request));
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ code: error.code, message: error.message }, error.status);
    }

    throw error;
  }
}

export { mcp as GET, mcp as POST, mcp as DELETE };
