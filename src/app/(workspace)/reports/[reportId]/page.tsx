import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "../report-access";
import { SavedReportView } from "../saved-report-view";

export const metadata: Metadata = { title: "Reports" };
export const instant = false;

export default async function SavedReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return (
    <Suspense>
      <ReportAccess>
        <SavedReportView reportId={reportId} />
      </ReportAccess>
    </Suspense>
  );
}
