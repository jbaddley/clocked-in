import type { Metadata } from "next";
import { headers } from "next/headers";
import { loadMcpCatalog } from "@/lib/mcp/catalog";
import { McpView } from "./mcp-view";

export const metadata: Metadata = { title: "MCP" };

function requestOrigin(headerList: Headers) {
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3025";
  const forwarded = headerList.get("x-forwarded-proto");
  const proto = forwarded ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function McpPage() {
  const headerList = await headers();
  return <McpView origin={requestOrigin(headerList)} groups={loadMcpCatalog()} />;
}
