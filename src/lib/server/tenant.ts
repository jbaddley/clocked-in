import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { classifyTenantHost, stripPort, tenantHeader } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const getTenantSlug = cache(async (): Promise<string | null> => {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  const configuredAppHost = process.env.APP_HOST?.trim();
  if (configuredAppHost) {
    return classifyTenantHost(host, configuredAppHost);
  }

  if (process.env.NODE_ENV !== "production") {
    const localSubdomain = classifyTenantHost(host, "localhost");
    if (localSubdomain) {
      return localSubdomain;
    }

    const hostname = stripPort(host);
    if (hostname === "127.0.0.1" || hostname === "localhost") {
      return store.get(tenantHeader)?.trim().toLowerCase() || null;
    }
  }

  return null;
});

export const getPinnedOrganization = cache(async () => {
  const slug = await getTenantSlug();
  if (!slug) {
    return { pinned: false as const, slug: null, organization: null };
  }

  const organization = await prisma.organization.findFirst({
    where: { slug },
    include: { theme: true },
  });
  return { pinned: true as const, slug, organization };
});

export async function requirePinnedOrganizationOrApex() {
  const state = await getPinnedOrganization();
  if (state.pinned && !state.organization) {
    notFound();
  }

  return state;
}
