import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeletons";
import { ReportAccess } from "./report-access";
import { ReportsRouteFrame } from "./reports-route-frame";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportAccess>
        <ReportsRouteFrame>{children}</ReportsRouteFrame>
      </ReportAccess>
    </Suspense>
  );
}
