import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { PageSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchInvitations, prefetchLookups, prefetchMembers } from "@/lib/server/prefetch";
import { MembersView } from "./members-view";

export const metadata: Metadata = { title: "People" };

export default function MembersPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <Members />
    </Suspense>
  );
}

async function Members() {
  const { organization } = await getWorkspace();
  if (!organization) return null;

  const queryClient = getQueryClient();
  await Promise.all([
    prefetchMembers(queryClient, organization.id),
    prefetchLookups(queryClient, organization.id),
    prefetchInvitations(queryClient, organization.id),
  ]);

  return (
    <Hydrate client={queryClient}>
      <MembersView />
    </Hydrate>
  );
}
