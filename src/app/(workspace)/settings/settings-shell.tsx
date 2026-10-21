"use client";

import { usePathname } from "next/navigation";
import { NoOrganization } from "@/components/no-organization";
import { SectionLayout } from "@/components/section-layout";
import { PageSkeleton } from "@/components/skeletons";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useWorkspace } from "@/hooks/use-workspace";
import { SettingsNav } from "./settings-nav";

const coordinatorSettings = new Set(["/settings/members", "/settings/lists"]);

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { organization, isAdmin, isCoordinator } = useWorkspace();
  const allowed = isAdmin || isCoordinator;
  useClientRedirect(Boolean(organization) && !allowed, "/dashboard");
  useClientRedirect(Boolean(organization) && isCoordinator && !isAdmin && !coordinatorSettings.has(pathname), "/settings/members");
  if (!organization) return <NoOrganization />;
  if (!allowed) return <PageSkeleton />;
  return <SectionLayout nav={<SettingsNav />}>{children}</SectionLayout>;
}
