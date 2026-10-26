import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "./report-access";
import { ReportsHome } from "./reports-home";

export const metadata: Metadata = { title: "Reports" };
export const instant = false;

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportAccess>
        <ReportsHome />
      </ReportAccess>
    </Suspense>
  );
}
