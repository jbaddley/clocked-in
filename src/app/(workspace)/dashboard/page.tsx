import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { NoOrganization } from "@/components/no-organization";
import { PageHeader } from "@/components/page-header";
import { DashboardSkeleton } from "@/components/skeletons";
import { toDateOnly } from "@/lib/format";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchEntries, prefetchLookups, prefetchReport } from "@/lib/server/prefetch";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

function weekStart() {
  const now = new Date();
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return toDateOnly(now);
}

async function Dashboard() {
  const { organization, viewer, role } = await getWorkspace();
  if (!organization) {
    return <NoOrganization />;
  }

  const queryClient = getQueryClient();
  const week = weekStart();
  await Promise.all([
    prefetchReport(queryClient, organization.id, {}),
    prefetchReport(queryClient, organization.id, { from: week }),
    prefetchEntries(queryClient, organization.id, viewer.id, {}),
    prefetchLookups(queryClient, organization.id),
  ]);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${viewer.name.split(" ")[0]}`}
        description={
          role === "VOLUNTEER" ? "Log and review your own hours." : `Here is how ${organization.name} is doing.`
        }
      />
      <Hydrate client={queryClient}>
        <DashboardView weekStart={week} />
      </Hydrate>
    </>
  );
}
