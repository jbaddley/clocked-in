import { NextResponse, type NextRequest } from "next/server";
import { refresh } from "@/lib/api/features/auth";
import { accessCookie, refreshCookie, verifyAccessToken } from "@/lib/api/security";
import { csharpApiUrl, forwardToCsharp, isCsharpApiPath } from "@/lib/server/csharp-api";
import { eraseSession, writeSession, type IssuedSession } from "@/lib/server/session-cookies";

const protectedPrefixes = [
  "/dashboard",
  "/log",
  "/entries",
  "/groups",
  "/reports",
  "/settings",
  "/profile",
  "/change-password",
  "/feedback",
];
const guestOnly = ["/login", "/signup"];

// Parallel requests often carry the same expired token; share one rotation so the
// second request does not present an already-revoked refresh token.
const inflight = new Map<string, { at: number; session: Promise<IssuedSession | null> }>();

function rotate(refreshToken: string) {
  const now = Date.now();
  for (const [key, entry] of inflight) {
    if (now - entry.at > 30_000) inflight.delete(key);
  }

  const existing = inflight.get(refreshToken);
  if (existing) {
    return existing.session;
  }

  const session = refresh({ refreshToken }).catch(() => null);
  inflight.set(refreshToken, { at: now, session });
  return session;
}

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function rewriteFeedbackApi(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== "/feedback" && !pathname.startsWith("/feedback/")) {
    return null;
  }

  if (request.headers.has("next-action")) {
    return null;
  }

  const accept = request.headers.get("accept") ?? "";
  const dest = request.headers.get("sec-fetch-dest") ?? "";
  const isDocument = dest === "document" || dest === "iframe" || accept.includes("text/html");
  const isApi =
    request.headers.has("authorization") ||
    (request.method !== "GET" && request.method !== "HEAD") ||
    accept.includes("application/json") ||
    !isDocument;
  if (!isApi) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/api${pathname}`;
  return NextResponse.rewrite(url);
}

export async function proxy(request: NextRequest) {
  const csharp = csharpApiUrl();
  if (csharp && isCsharpApiPath(request.nextUrl.pathname, request) && request.headers.has("authorization")) {
    return forwardToCsharp(request, csharp);
  }

  const feedbackApi = rewriteFeedbackApi(request);
  if (feedbackApi) {
    return feedbackApi;
  }

  if (request.headers.has("authorization")) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  const accessToken = request.cookies.get(accessCookie)?.value;
  const refreshToken = request.cookies.get(refreshCookie)?.value;
  let signedIn = Boolean(accessToken && (await verifyAccessToken(accessToken)));
  let issued: IssuedSession | null = null;
  let expired = false;

  if (!signedIn && refreshToken) {
    issued = await rotate(refreshToken);
    signedIn = issued !== null;
    expired = issued === null;
  }

  let response: NextResponse;
  if (!signedIn && matches(pathname, protectedPrefixes)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    response = NextResponse.redirect(login);
  } else if (signedIn && (matches(pathname, guestOnly) || pathname === "/")) {
    response = NextResponse.redirect(new URL("/dashboard", request.url));
  } else if (issued) {
    request.cookies.set(accessCookie, issued.accessToken);
    request.cookies.set(refreshCookie, issued.refreshToken);
    const headers = new Headers(request.headers);
    headers.set("cookie", request.cookies.toString());
    response = NextResponse.next({ request: { headers } });
  } else {
    response = NextResponse.next();
  }

  if (issued) {
    writeSession(response.cookies, issued);
  } else if (expired) {
    eraseSession(response.cookies);
  }

  if (csharp && isCsharpApiPath(request.nextUrl.pathname, request)) {
    const token = issued?.accessToken ?? request.cookies.get(accessCookie)?.value;
    const forwarded = await forwardToCsharp(request, csharp, token);
    if (issued) {
      writeSession(forwarded.cookies, issued);
    } else if (expired) {
      eraseSession(forwarded.cookies);
    }

    return forwarded;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
