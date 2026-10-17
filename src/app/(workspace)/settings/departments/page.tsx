import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { PageSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchLookups } from "@/lib/server/prefetch";
import { DepartmentsView } from "./departments-view";

export const metadata: Metadata = { title: "Departments" };

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <Departments />
    </Suspense>
  );
}

async function Departments() {
  const { organization } = await getWorkspace();
  if (!organization) return null;

  const queryClient = getQueryClient();
  await prefetchLookups(queryClient, organization.id);

  return (
    <Hydrate client={queryClient}>
      <DepartmentsView />
    </Hydrate>
  );
}
