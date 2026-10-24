"use client";

import { StatsSkeleton } from "@/components/skeletons";
import { ReportsView } from "./reports-view";
import { useSavedReports } from "./report-switcher";
import { SavedReportView } from "./saved-report-view";

export function ReportsHome() {
  const { reports, isPending } = useSavedReports();
  if (isPending) return <StatsSkeleton />;
  const selected = reports.find((report) => report.isDefault);
  if (selected) return <SavedReportView reportId={selected.id} />;
  return <ReportsView />;
}
