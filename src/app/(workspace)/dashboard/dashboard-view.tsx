"use client";

import { ChartColumnIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { DashboardSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { useReportEntries, withEntries } from "@/hooks/use-report-entries";
import { useReport } from "@/hooks/use-report";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { useWorkspace } from "@/hooks/use-workspace";
import { dashboardLayout } from "@/lib/report-layout";
import { UnclassifiedBanner } from "@/components/unclassified-banner";

export function DashboardView() {
  const { isAdmin } = useWorkspace();
  const { reports, isPending: reportsPending } = useSavedReports();
  const dashboard = reports.find((report) => report.isDashboard);
  const builtin = useReport({});
  const { entries } = useReportEntries();
  const data = withEntries(builtin.data, entries);
  const cards = dashboard?.layout.cards ?? dashboardLayout().cards;
  const pending = reportsPending || builtin.isPending;

  if (pending) return <DashboardSkeleton />;
  if (builtin.isError || !data) {
    return (
      <EmptyState
        icon={ChartColumnIcon}
        title="The dashboard did not load"
        description="Your hours are safe. Try again in a moment."
        action={
          <Button type="button" variant="outline" onClick={() => builtin.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

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
