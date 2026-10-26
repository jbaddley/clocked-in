"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateRangeFilter, rangeFromSearch } from "@/components/date-range-filter";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { ReportActions } from "./report-actions";
import { StatsSkeleton } from "@/components/skeletons";
import { useLookups } from "@/hooks/use-lookups";
import { useOrganization } from "@/hooks/use-workspace";
import { savedReportDataQuery, savedReportQuery } from "@/lib/queries";
import type { DateRange } from "@/lib/types";
import type { ReportFilters } from "@/lib/report-layout";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { ReportSwitcher, useSavedReports } from "./report-switcher";

function useReportRange(filters: ReportFilters) {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const touched = search.get("dates") === "1";
  const urlRange = rangeFromSearch(search);
  const range: DateRange = touched ? urlRange : { from: filters.from, to: filters.to };

  function setRange(next: DateRange) {
    const params = new URLSearchParams(search);
    params.set("dates", "1");
    if (next.from) params.set("from", next.from);
    else params.delete("from");
    if (next.to) params.set("to", next.to);
    else params.delete("to");
    const text = params.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  return { range, setRange };
}

function SavedReportBody({ report }: { report: SavedReport }) {
  const organization = useOrganization();
  const { names } = useLookups();
  const { range, setRange } = useReportRange(report.filters);
  const data = useQuery(savedReportDataQuery(organization.id, report.id, range));
  const filters = report.filters;
  const applied = [
    filters.departmentId ? names.department.get(filters.departmentId) : null,
    filters.taskCategoryId ? names.category.get(filters.taskCategoryId) : null,
    filters.projectId ? names.project.get(filters.projectId) : null,
    filters.userId ? "One person" : null,
  ].filter(Boolean);

  return (
    <>
      <PageHeader
        actions={
          <div className="flex w-full flex-wrap items-center gap-2">
            <DateRangeFilter range={range} onChange={setRange} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <ReportSwitcher active={report.id} />
              <ReportActions range={range} />
              {applied.length > 0 ? <p className="text-xs text-muted-foreground">{applied.join(" · ")}</p> : null}
              {data.isFetching ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
            </div>
          </div>
        }
      />
      <ReportGrid cards={report.layout.cards} data={data.data} />
    </>
  );
}

export function SavedReportView({ reportId }: { reportId: string }) {
  const organization = useOrganization();
  const { reports, isPending } = useSavedReports();
  const cached = reports.find((item) => item.id === reportId);
  const report = useQuery({
    ...savedReportQuery(organization.id, reportId),
    ...(cached ? { initialData: cached } : {}),
  });

  if ((isPending && !cached) || report.isPending) {
    return <StatsSkeleton />;
  }

  if (report.isError || !report.data) {
    return <p className="text-sm text-muted-foreground">That report is not available.</p>;
  }

  return <SavedReportBody report={report.data} />;
}
