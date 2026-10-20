import type { Metadata } from "next";
<<<<<<< Updated upstream
=======
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchEntries, prefetchLookups } from "@/lib/server/prefetch";
>>>>>>> Stashed changes
import { OwnTimeView } from "./own-view";

export const metadata: Metadata = { title: "Log time" };

<<<<<<< Updated upstream
export default function OwnTimePage() {
  return <OwnTimeView />;
=======
type Search = { from?: string; to?: string };

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export default function OwnTimePage({ searchParams }: PageProps<"/log/own">) {
  return (
    <Suspense fallback={null}>
      <OwnTime searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function OwnTime({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ organization, viewer }, search] = await Promise.all([getWorkspace(), searchParams]);
  if (!organization) return null;

  const range = {
    from: search.from && dateOnly.test(search.from) ? search.from : undefined,
    to: search.to && dateOnly.test(search.to) ? search.to : undefined,
  };
  const queryClient = getQueryClient();
  await Promise.all([
    prefetchLookups(queryClient, organization.id),
    prefetchEntries(queryClient, organization.id, viewer.id, range),
  ]);

  return (
    <Hydrate client={queryClient}>
      <OwnTimeView range={range} />
    </Hydrate>
  );
>>>>>>> Stashed changes
}
