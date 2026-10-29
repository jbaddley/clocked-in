import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { accessForSubject } from "@/lib/api/access";
import { accessCookie, refreshCookie, verifyAccessToken } from "@/lib/api/security";
import { eraseSession, writeSession, type IssuedSession } from "@/lib/server/session-cookies";
import { getTenantSlug } from "@/lib/server/tenant";

export const getAccess = cache(async () => {
  const [store, tenantSlug] = await Promise.all([cookies(), getTenantSlug()]);
  const token = store.get(accessCookie)?.value;
  const subject = token ? await verifyAccessToken(token) : null;
  return subject ? accessForSubject(subject, tenantSlug) : null;
});

export async function requireAccess(options?: { allowPasswordChange?: boolean }) {
  const access = (await getAccess()) ?? redirect("/login");
  if (access.caller.mustChangePassword && !options?.allowPasswordChange) {
    redirect("/change-password");
  }

  return access;
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
