import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";
import { ReportDesigner } from "../../report-designer";

export const metadata: Metadata = { title: "Design report" };

export default async function DesignReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const workspace = await getWorkspace();
  if (!canSeeReports(workspace)) redirect("/dashboard");
  if (!workspace.isAdmin) redirect("/reports");

  const { reportId } = await params;
  return (
    <Suspense>
      <ReportDesigner reportId={reportId} />
    </Suspense>
  );
}
