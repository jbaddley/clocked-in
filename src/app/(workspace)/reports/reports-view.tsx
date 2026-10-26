"use client";

import { useSearchParams } from "next/navigation";
import { DateRangeFilter, rangeFromSearch } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { CardSkeleton, StatsSkeleton } from "@/components/skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLabels } from "@/hooks/use-labels";
import { useReport } from "@/hooks/use-report";
import { reportTemplate, type ReportTemplateId } from "@/lib/report-layout";
import { ReportActions } from "./report-actions";
import { ReportSwitcher } from "./report-switcher";

const tabs: { id: ReportTemplateId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "people", label: "People" },
  { id: "groups", label: "Group sessions" },
  { id: "staff", label: "Staff" },
];

export function ReportsView() {
  const copy = useLabels();
  const range = rangeFromSearch(useSearchParams());
  const { data: report, isFetching, isPending } = useReport(range);

  return (
    <>
      <PageHeader
        actions={
          <div className="flex w-full flex-wrap items-center gap-2">
            <DateRangeFilter range={range} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ReportSwitcher active="standard" />
              <ReportActions range={range} />
              {isFetching ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
            </div>
          </div>
        }
      />
      {isPending ? (
        <>
          <StatsSkeleton />
          <div className="grid gap-6 xl:grid-cols-2">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
        </>
      ) : report ? (
        <Tabs defaultValue="summary">
          <TabsList className="w-full sm:w-fit">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="flex-1 sm:flex-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <ReportGrid cards={reportTemplate(tab.id, copy).cards} data={report} />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </>
  );
}
