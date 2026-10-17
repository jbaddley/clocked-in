import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { NoOrganization } from "@/components/no-organization";
import { DashboardSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchReport } from "@/lib/server/prefetch";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Reports" };

type Search = { from?: string; to?: string };

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Reports searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function Reports({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ organization }, search] = await Promise.all([getWorkspace(), searchParams]);
  if (!organization) {
    return <NoOrganization />;
  }

  const range = {
    from: search.from && dateOnly.test(search.from) ? search.from : undefined,
    to: search.to && dateOnly.test(search.to) ? search.to : undefined,
  };
  const queryClient = getQueryClient();
  await prefetchReport(queryClient, organization.id, range);

  return (
    <Hydrate client={queryClient}>
      <ReportsView range={range} />
    </Hydrate>
  );
}
