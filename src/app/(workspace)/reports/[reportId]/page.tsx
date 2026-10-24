import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";
import { SavedReportView } from "../saved-report-view";

export const metadata: Metadata = { title: "Reports" };

export default async function SavedReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const workspace = await getWorkspace();
  if (!canSeeReports(workspace)) {
    redirect("/dashboard");
  }

  const { reportId } = await params;
  return (
    <Suspense>
      <SavedReportView reportId={reportId} />
    </Suspense>
  );
}
