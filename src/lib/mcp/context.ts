import { AsyncLocalStorage } from "node:async_hooks";
import { Access } from "@/lib/api/access";

const current = new AsyncLocalStorage<Access>();

export function mcpAccess() {
  const access = current.getStore();
  if (!access) {
    throw new Error("MCP request has no access.");
  }

  return access;
}

export function withMcpAccess<T>(access: Access, work: () => Promise<T>) {
  return current.run(access, work);
}
