import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { NoOrganization } from "@/components/no-organization";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { today } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchEntries, prefetchLookups, prefetchMembers } from "@/lib/server/prefetch";
import { LogView } from "./log-view";

export const metadata: Metadata = { title: "Log time" };

export default function LogPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <Log />
    </Suspense>
  );
}

async function Log() {
  const { organization, viewer } = await getWorkspace();
  if (!organization) {
    return <NoOrganization />;
  }

  const queryClient = getQueryClient();
  const day = today();
  await Promise.all([
    prefetchLookups(queryClient, organization.id),
    prefetchMembers(queryClient, organization.id),
    prefetchEntries(queryClient, organization.id, viewer.id, { from: day, to: day }),
  ]);

  return (
    <>
      <PageHeader />
      <Hydrate client={queryClient}>
        <LogView />
      </Hydrate>
    </>
  );
}
