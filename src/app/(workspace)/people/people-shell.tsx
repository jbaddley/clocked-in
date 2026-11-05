"use client";

import { usePathname } from "next/navigation";
import { NoOrganization } from "@/components/no-organization";
import { SectionLayout } from "@/components/section-layout";
import { PageSkeleton } from "@/components/skeletons";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useWorkspace } from "@/hooks/use-workspace";
import { PeopleNav } from "./people-nav";

const coordinatorPeople = new Set(["/people", "/people/invites"]);

export function PeopleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { organization, isAdmin, isCoordinator } = useWorkspace();
  const allowed = isAdmin || (isCoordinator && coordinatorPeople.has(pathname));
  useClientRedirect(Boolean(organization) && !isAdmin && !isCoordinator, "/dashboard");
  useClientRedirect(Boolean(organization) && isCoordinator && !isAdmin && !coordinatorPeople.has(pathname), "/people");
  if (!organization) return <NoOrganization />;
  if (!allowed) return <PageSkeleton />;
  return <SectionLayout nav={<PeopleNav />}>{children}</SectionLayout>;
}
