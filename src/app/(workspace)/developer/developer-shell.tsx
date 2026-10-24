"use client";

import { NoOrganization } from "@/components/no-organization";
import { SectionLayout } from "@/components/section-layout";
import { PageSkeleton } from "@/components/skeletons";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useWorkspace } from "@/hooks/use-workspace";
import { DeveloperNav } from "./developer-nav";

export function DeveloperShell({ children }: { children: React.ReactNode }) {
  const { organization, isAdmin } = useWorkspace();
  useClientRedirect(Boolean(organization) && !isAdmin, "/dashboard");
  if (!organization) return <NoOrganization />;
  if (!isAdmin) return <PageSkeleton />;
  return <SectionLayout nav={<DeveloperNav />}>{children}</SectionLayout>;
}
