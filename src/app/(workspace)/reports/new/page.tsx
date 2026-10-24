import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";
import { ReportDesigner } from "../report-designer";

export const metadata: Metadata = { title: "New report" };

export default async function NewReportPage() {
  const workspace = await getWorkspace();
  if (!canSeeReports(workspace)) redirect("/dashboard");
  if (!workspace.isAdmin) redirect("/reports");

  return (
    <Suspense>
      <ReportDesigner />
    </Suspense>
  );
}
