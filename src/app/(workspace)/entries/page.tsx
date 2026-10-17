import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { NoOrganization } from "@/components/no-organization";
import { PageSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchEntries, prefetchLookups, prefetchMembers } from "@/lib/server/prefetch";
import { EntriesView } from "./entries-view";

export const metadata: Metadata = { title: "Entries" };

type Search = { from?: string; to?: string; person?: string };

export default function EntriesPage({ searchParams }: PageProps<"/entries">) {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <Entries searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

async function Entries({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ organization, viewer, isAdmin }, search] = await Promise.all([getWorkspace(), searchParams]);
  if (!organization) {
    return <NoOrganization />;
  }

  const range = {
    from: search.from && dateOnly.test(search.from) ? search.from : undefined,
    to: search.to && dateOnly.test(search.to) ? search.to : undefined,
  };
  const personId = isAdmin && search.person ? search.person : viewer.id;
  const queryClient = getQueryClient();
  await Promise.all([
    prefetchEntries(queryClient, organization.id, personId, range),
    prefetchLookups(queryClient, organization.id),
    isAdmin ? prefetchMembers(queryClient, organization.id) : null,
  ]);

  return (
    <Hydrate client={queryClient}>
      <EntriesView range={range} personId={personId} />
    </Hydrate>
  );
}
