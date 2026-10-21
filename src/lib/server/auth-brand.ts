import "server-only";
import { cookies } from "next/headers";
import { themeJson } from "@/lib/api/features/themes";
import { prisma } from "@/lib/prisma";
import { defaultOrganizationId } from "@/lib/portal";
import { organizationCookie } from "@/lib/server/session-cookies";

export async function getAuthBrand() {
  const store = await cookies();
  const id = store.get(organizationCookie)?.value || defaultOrganizationId();
  if (!id) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { id },
    include: { theme: true },
  });
  if (!organization) {
    return null;
  }

  return {
    name: organization.name,
    markUrl: organization.markUrl,
    wordmarkUrl: organization.wordmarkUrl,
    wordmarkOnLightUrl: organization.wordmarkOnLightUrl,
    theme: organization.theme ? themeJson(organization.theme) : null,
  };
}
