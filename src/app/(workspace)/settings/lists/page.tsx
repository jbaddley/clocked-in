import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { PageSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchLookups } from "@/lib/server/prefetch";
import { ListsView } from "./lists-view";

export const metadata: Metadata = { title: "Projects and lists" };

export default function ListsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Lists />
    </Suspense>
  );
}

async function Lists() {
  const { organization } = await getWorkspace();
  if (!organization) return null;

  const queryClient = getQueryClient();
  await prefetchLookups(queryClient, organization.id);

  return (
    <Hydrate client={queryClient}>
      <ListsView />
    </Hydrate>
  );
}
