"use client";

import { usePathname } from "next/navigation";
import { NoOrganization } from "@/components/no-organization";
import { useWorkspace } from "@/hooks/use-workspace";

const apexAllowedWithoutOrg = ["/profile", "/feedback", "/organization/new"];
const tenantAllowedWithoutOrg = ["/profile"];

export function OrganizationGate({ children }: { children: React.ReactNode }) {
  const { organization, isTenantHost } = useWorkspace();
  const pathname = usePathname();
  const allowed = isTenantHost ? tenantAllowedWithoutOrg : apexAllowedWithoutOrg;
  if (!organization && !allowed.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return <NoOrganization />;
  }

  return children;
}
