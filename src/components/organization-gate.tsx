"use client";

import { usePathname } from "next/navigation";
import { NoOrganization } from "@/components/no-organization";
import { useWorkspace } from "@/hooks/use-workspace";

const allowedWithoutOrg = ["/profile", "/feedback", "/organization/new"];

export function OrganizationGate({ children }: { children: React.ReactNode }) {
  const { organization } = useWorkspace();
  const pathname = usePathname();
  if (!organization && !allowedWithoutOrg.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return <NoOrganization />;
  }

  return children;
}
