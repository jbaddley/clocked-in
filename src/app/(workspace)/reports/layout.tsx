import { Suspense } from "react";
import { ReportAccess } from "./report-access";
import { ReportsRouteFrame } from "./reports-route-frame";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <ReportAccess>
        <ReportsRouteFrame>{children}</ReportsRouteFrame>
      </ReportAccess>
    </Suspense>
  );
}
