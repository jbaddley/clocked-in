"use client";

import { usePathname } from "next/navigation";
import { isReportViewerPath } from "@/lib/report-slug";
import { ReportWorkspace } from "./report-workspace";

export function ReportsRouteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isReportViewerPath(pathname ?? "")) {
    return <ReportWorkspace />;
  }
  return children;
}
