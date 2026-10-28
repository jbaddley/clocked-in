"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { DashboardSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { useReportEntries, withEntries } from "@/hooks/use-report-entries";
import { useReport } from "@/hooks/use-report";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { savedReportDataQuery } from "@/lib/queries";
import { dashboardLayout } from "@/lib/report-layout";
import { useSavedReports } from "@/app/(workspace)/reports/report-switcher";
import { UnclassifiedBanner } from "@/components/unclassified-banner";

export function DashboardView() {
  const organization = useOrganization();
  const { isAdmin } = useWorkspace();
  const { reports, isPending: reportsPending } = useSavedReports();
  const dashboard = reports.find((report) => report.isDashboard);
  const builtin = useReport({});
  const saved = useQuery({
    ...savedReportDataQuery(organization.id, dashboard?.id ?? "", {}),
    enabled: Boolean(dashboard),
  });
  const { entries } = useReportEntries();
  const raw = dashboard ? saved.data : builtin.data;
  const data = withEntries(raw, entries);
  const cards = dashboard?.layout.cards ?? dashboardLayout().cards;
  const pending = reportsPending || (dashboard ? saved.isPending : builtin.isPending);

  if (pending) return <DashboardSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <UnclassifiedBanner />
      {isAdmin ? (
        <PageHeader
          actions={
            <Link href="/dashboard/design" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Edit Dashboard
            </Link>
          }
        />
      ) : null}
      <ReportGrid cards={cards} data={data} />
    </div>
  );
}
