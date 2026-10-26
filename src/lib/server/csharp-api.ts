import { accessCookie } from "@/lib/api/security";
import { type NextRequest, NextResponse } from "next/server";

const prefixes = [
  "/auth",
  "/users",
  "/organizations",
  "/roles",
  "/departments",
  "/tags",
  "/task-categories",
  "/hourly-rates",
  "/projects",
  "/time-entries",
  "/time",
  "/collective-time-entries",
  "/invitations",
  "/feedback",
  "/platform",
  "/volunteer-needs",
];

export function csharpApiUrl() {
  const url = process.env.CSHARP_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

export function isCsharpApiPath(pathname: string, request?: NextRequest) {
  if (pathname === "/health" || pathname.startsWith("/health/")) {
    return false;
  }

  // The web app reads departments, projects, categories, tags, and rates together.
  // Keep that on Next so one request is not forwarded as five API calls.
  if (/^\/organizations\/[^/]+\/lookups$/.test(pathname)) {
    return false;
  }

  if (request && isHtmlDocument(request) && (pathname === "/feedback" || pathname.startsWith("/feedback/"))) {
    return false;
  }

  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isHtmlDocument(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const dest = request.headers.get("sec-fetch-dest") ?? "";
  return request.method === "GET" && (dest === "document" || dest === "iframe" || accept.includes("text/html"));
}

export async function forwardToCsharp(request: NextRequest, baseUrl: string, accessToken?: string) {
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `${baseUrl}/`);
  const headers = new Headers();
  for (const name of ["content-type", "authorization", "x-api-key", "accept"]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const token = accessToken ?? request.cookies.get(accessCookie)?.value;
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const method = request.method.toUpperCase();
  const response = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
    redirect: "manual",
  });
  const outgoing = new Headers(response.headers);
  outgoing.delete("content-encoding");
  outgoing.delete("transfer-encoding");
  return new NextResponse(response.body, { status: response.status, headers: outgoing });
}
