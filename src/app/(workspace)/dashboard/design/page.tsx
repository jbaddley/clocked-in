import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "@/app/(workspace)/reports/report-access";
import { ReportDesigner } from "@/app/(workspace)/reports/report-designer";

export const metadata: Metadata = { title: "Edit dashboard" };
export const instant = false;

export default function DashboardDesignPage() {
  return (
    <Suspense>
      <ReportAccess admin>
        <ReportDesigner dashboard />
      </ReportAccess>
    </Suspense>
  );
}
