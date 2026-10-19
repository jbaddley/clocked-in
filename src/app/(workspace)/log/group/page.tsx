import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { getQueryClient } from "@/lib/query-client";
import { canLogGroupTime } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchGroupSessions, prefetchLookups } from "@/lib/server/prefetch";
import { GroupTimeView } from "./group-view";

export const metadata: Metadata = { title: "Log group time" };

export default function GroupTimePage() {
  return (
    <Suspense fallback={null}>
      <GroupTime />
    </Suspense>
  );
}

async function GroupTime() {
  const { organization, groupDepartments } = await getWorkspace();
  if (!organization) return null;
  if (!canLogGroupTime(groupDepartments)) redirect("/log/own");

  const queryClient = getQueryClient();
  await Promise.all([prefetchLookups(queryClient, organization.id), prefetchGroupSessions(queryClient, organization.id)]);

  return (
    <Hydrate client={queryClient}>
      <GroupTimeView />
    </Hydrate>
  );
}
