import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "../../report-access";
import { ReportDesigner } from "../../report-designer";

export const metadata: Metadata = { title: "Design report" };
export const instant = false;

export default async function DesignReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return (
    <Suspense>
      <ReportAccess admin>
        <ReportDesigner reportId={reportId} />
      </ReportAccess>
    </Suspense>
  );
}
