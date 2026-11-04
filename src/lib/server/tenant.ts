import "server-only";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { resolveRequestTenantSlug } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const getTenantSlug = cache(async (): Promise<string | null> => {
  const store = await headers();
  return resolveRequestTenantSlug(store);
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
