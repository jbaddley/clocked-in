import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { NoOrganization } from "@/components/no-organization";
import { PageSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchGroupSessions, prefetchLookups } from "@/lib/server/prefetch";
import { GroupsView } from "./groups-view";

export const metadata: Metadata = { title: "Group time" };

export default function GroupsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <Groups />
    </Suspense>
  );
}

async function Groups() {
  const { organization } = await getWorkspace();
  if (!organization) {
    return <NoOrganization />;
  }

  const queryClient = getQueryClient();
  await Promise.all([prefetchLookups(queryClient, organization.id), prefetchGroupSessions(queryClient, organization.id)]);

  return (
    <Hydrate client={queryClient}>
      <GroupsView />
    </Hydrate>
  );
}
