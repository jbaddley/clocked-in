import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchLookups, prefetchMembers } from "@/lib/server/prefetch";
import { MemberTimeView } from "./member-view";

export const metadata: Metadata = { title: "Log member time" };

export default function MemberTimePage() {
  return (
    <Suspense fallback={null}>
      <MemberTime />
    </Suspense>
  );
}

async function MemberTime() {
  const { organization, isAdmin } = await getWorkspace();
  if (!organization) return null;
  if (!isAdmin) redirect("/log/own");

  const queryClient = getQueryClient();
  await Promise.all([prefetchLookups(queryClient, organization.id), prefetchMembers(queryClient, organization.id)]);

  return (
    <Hydrate client={queryClient}>
      <MemberTimeView />
    </Hydrate>
  );
}
