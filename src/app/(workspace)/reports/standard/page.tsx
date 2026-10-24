import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";
import { ReportsView } from "../reports-view";

export const metadata: Metadata = { title: "Reports" };

export default async function StandardReportPage() {
  const workspace = await getWorkspace();
  if (!canSeeReports(workspace)) {
    redirect("/dashboard");
  }

  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
