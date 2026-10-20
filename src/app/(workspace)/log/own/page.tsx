import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { getQueryClient } from "@/lib/query-client";
import { today } from "@/lib/format";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchEntries, prefetchLookups } from "@/lib/server/prefetch";
import { OwnTimeView } from "./own-view";

export const metadata: Metadata = { title: "Log time" };

export default function OwnTimePage() {
  return (
    <Suspense fallback={null}>
      <OwnTime />
    </Suspense>
  );
}

async function OwnTime() {
  const { organization, viewer } = await getWorkspace();
  if (!organization) return null;

  const queryClient = getQueryClient();
  const day = today();
  await Promise.all([
    prefetchLookups(queryClient, organization.id),
    prefetchEntries(queryClient, organization.id, viewer.id, { from: day, to: day }),
  ]);

  return (
    <Hydrate client={queryClient}>
      <OwnTimeView />
    </Hydrate>
  );
}
