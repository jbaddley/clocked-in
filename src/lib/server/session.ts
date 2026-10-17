import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { accessForSubject } from "@/lib/api/access";
import { accessCookie, refreshCookie, verifyAccessToken } from "@/lib/api/security";
import { eraseSession, writeSession, type IssuedSession } from "@/lib/server/session-cookies";

export const getAccess = cache(async () => {
  const token = (await cookies()).get(accessCookie)?.value;
  const subject = token ? await verifyAccessToken(token) : null;
  return subject ? accessForSubject(subject) : null;
});

export async function requireAccess() {
  return (await getAccess()) ?? redirect("/login");
}

export async function setSessionCookies(session: IssuedSession) {
  writeSession(await cookies(), session);
}

export async function clearSessionCookies() {
  eraseSession(await cookies());
}

export async function currentRefreshToken() {
  return (await cookies()).get(refreshCookie)?.value ?? null;
}
