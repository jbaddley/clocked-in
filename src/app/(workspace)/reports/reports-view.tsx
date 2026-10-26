"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DateRangeFilter, rangeFromSearch } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { CardSkeleton, StatsSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLabels } from "@/hooks/use-labels";
import type { ReportTemplate } from "@/lib/api/features/report-templates";
import type { EntityLabels } from "@/lib/labels";
import type { Report } from "@/lib/types";
import { useReport } from "@/hooks/use-report";
import { useWorkspace } from "@/hooks/use-workspace";
import { reportTemplatesQuery } from "@/lib/queries";
import { reportTemplate, type ReportTemplateId } from "@/lib/report-layout";
import { cn } from "cn";
import { ReportActions } from "./report-actions";
import { ReportSwitcher } from "./report-switcher";

const fallbackTabs: { id: ReportTemplateId; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "people", label: "People" },
  { id: "groups", label: "Group sessions" },
  { id: "staff", label: "Staff" },
];

export function ReportsView() {
  const copy = useLabels();
  const { organization, isAdmin } = useWorkspace();
  const range = rangeFromSearch(useSearchParams());
  const { data: report, isFetching, isPending } = useReport(range);
  const templates = useQuery({ ...reportTemplatesQuery(organization?.id ?? ""), enabled: Boolean(organization) });
  const savedTabs = (templates.data ?? []).filter((item) => item.key);
  const loading = isPending || (Boolean(organization) && templates.isPending);

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
      {loading ? (
        <>
          <StatsSkeleton />
          <div className="grid gap-6 xl:grid-cols-2">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
        </>
      ) : report ? (
        <ReportTabs report={report} savedTabs={savedTabs} copy={copy} isAdmin={isAdmin} />
      ) : null}
    </>
  );
}

function ReportTabs({
  report,
  savedTabs,
  copy,
  isAdmin,
}: {
  report: Report;
  savedTabs: ReportTemplate[];
  copy: EntityLabels;
  isAdmin: boolean;
}) {
  const shown = savedTabs.length > 0
    ? savedTabs.map((item) => ({ value: item.key ?? item.id, label: item.name, cards: item.layout.cards, editId: item.id }))
    : fallbackTabs.map((tab) => ({ value: tab.id, label: tab.label, cards: reportTemplate(tab.id, copy).cards, editId: null }));

  return (
    <Tabs defaultValue={shown[0]?.value ?? "summary"}>
      <TabsList className="w-full sm:w-fit">
        {shown.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-1 sm:flex-none">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {shown.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {isAdmin && tab.editId ? (
            <div className="mb-3 flex justify-end">
              <Link href={`/reports/templates/${tab.editId}/design`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Edit template
              </Link>
            </div>
          ) : null}
          <ReportGrid cards={tab.cards} data={report} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
