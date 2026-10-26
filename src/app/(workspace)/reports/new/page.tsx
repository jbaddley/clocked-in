import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "../report-access";
import { ReportDesigner } from "../report-designer";

export const metadata: Metadata = { title: "New report" };
export const instant = false;

export default function NewReportPage() {
  return (
    <Suspense>
      <ReportAccess admin>
        <ReportDesigner />
      </ReportAccess>
    </Suspense>
  );
}
