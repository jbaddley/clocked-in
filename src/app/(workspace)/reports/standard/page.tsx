import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "../report-access";
import { ReportsView } from "../reports-view";

export const metadata: Metadata = { title: "Reports" };
export const instant = false;

export default function StandardReportPage() {
  return (
    <Suspense>
      <ReportAccess>
        <ReportsView />
      </ReportAccess>
    </Suspense>
  );
}
