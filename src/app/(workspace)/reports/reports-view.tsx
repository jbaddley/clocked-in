"use client";

import { ClockIcon, DownloadIcon, HandCoinsIcon, ListChecksIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { SummaryBars } from "@/components/charts";
import { DateRangeFilter, rangeFromSearch } from "@/components/date-range-filter";
import { CardSkeleton, StatsSkeleton } from "@/components/skeletons";
import { GroupTable } from "@/components/group-table";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLabels } from "@/hooks/use-labels";
import { useReport } from "@/hooks/use-report";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { canLogGroupTime } from "@/lib/roles";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { csvUrl, summaryCsvUrl } from "@/lib/queries";
import type { DateRange, ReportGroup } from "@/lib/types";

function describe(range: DateRange) {
  if (range.from && range.to) return `${formatDate(range.from)} to ${formatDate(range.to)}`;
  if (range.from) return `Since ${formatDate(range.from)}`;
  if (range.to) return `Through ${formatDate(range.to)}`;
  return "All time";
}

function ChartCard({ title, rows, children }: { title: string; rows: ReportGroup[]; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? children : <p className="text-sm text-muted-foreground">No hours in this range.</p>}
      </CardContent>
    </Card>
  );
}

export function ReportsView() {
  const organization = useOrganization();
  const { groupDepartments } = useWorkspace();
  const copy = useLabels();
  const range = rangeFromSearch(useSearchParams());
  const { data: report, isFetching, isPending } = useReport(range);

  return (
    <>
      <PageHeader
        description={`${describe(range)} · valued at ${formatCurrency(organization.volunteerHourlyRate)}/h (${organization.rateSourceYear})`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={csvUrl(organization.id, range)} download="volunteer-log.csv" className={buttonVariants({ variant: "outline", className: "h-9" })}>
              <DownloadIcon />
              Volunteer Log
            </a>
            <a href={summaryCsvUrl(organization.id, range)} download="summary.csv" className={buttonVariants({ variant: "outline", className: "h-9" })}>
              <DownloadIcon />
              Summary
            </a>
          </div>
        }
      />
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <DateRangeFilter range={range} />
        {isFetching ? <span className="text-xs text-muted-foreground sm:ml-auto">Updating…</span> : null}
      </div>

      {isPending ? (
        <>
          <StatsSkeleton />
          <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
        </>
      ) : report ? (
        <Tabs defaultValue="summary" className="gap-6">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="summary" className="flex-1 sm:flex-none">
              Summary
            </TabsTrigger>
            <TabsTrigger value="people" className="flex-1 sm:flex-none">
              People
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex-1 sm:flex-none">
              Group sessions
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex-1 sm:flex-none">
              Staff
            </TabsTrigger>
          </TabsList>
          <TabsContent value="summary" className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ClockIcon} label="Total volunteer hours" value={formatNumber(report.user.hours)} />
              <StatCard icon={HandCoinsIcon} tone="success" label="In-kind value" value={formatCurrency(report.user.inKind)} />
              <StatCard icon={UsersIcon} tone="highlight" label="Volunteers" value={report.user.volunteers} />
              <StatCard icon={ListChecksIcon} tone="accent" label="Entries" value={report.user.entries} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
              <ChartCard title={`Hours by ${copy.department.toLowerCase()}`} rows={report.user.byDepartment}>
                <SummaryBars rows={report.user.byDepartment} orientation="vertical" />
              </ChartCard>
              <ChartCard title={`Hours by ${copy.taskCategory.toLowerCase()}`} rows={report.user.byCategory}>
                <SummaryBars rows={report.user.byCategory} orientation="vertical" />
              </ChartCard>
              <ChartCard title="In-kind by month" rows={report.user.byMonth}>
                <SummaryBars rows={report.user.byMonth} valueKey="inKind" format="currency" orientation="vertical" />
              </ChartCard>
              <ChartCard title="Hours by volunteer" rows={report.user.byVolunteer}>
                <SummaryBars rows={report.user.byVolunteer} />
              </ChartCard>
              <ChartCard title="Hours by month" rows={report.user.byMonth}>
                <SummaryBars rows={report.user.byMonth} orientation="vertical" />
              </ChartCard>
              <ChartCard title={`Hours by ${copy.project.toLowerCase()}`} rows={report.user.byProject}>
                <SummaryBars rows={report.user.byProject} />
              </ChartCard>
            </div>
          </TabsContent>
          <TabsContent value="people" className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ClockIcon} label="Total volunteer hours" value={formatNumber(report.user.hours)} />
              <StatCard icon={HandCoinsIcon} tone="success" label="In-kind value" value={formatCurrency(report.user.inKind)} />
              <StatCard icon={UsersIcon} tone="highlight" label="Volunteers" value={report.user.volunteers} />
              <StatCard icon={ListChecksIcon} tone="accent" label="Entries" value={report.user.entries} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <GroupTable title={`By ${copy.project.toLowerCase()}`} rows={report.user.byProject} total={report.user.hours} showVolunteers />
              <GroupTable title="By person" rows={report.user.byPerson} total={report.user.hours} />
              <GroupTable title={`By ${copy.department.toLowerCase()}`} rows={report.user.byDepartment} total={report.user.hours} showVolunteers />
              <GroupTable title={`By ${copy.taskCategory.toLowerCase()}`} rows={report.user.byCategory} total={report.user.hours} showVolunteers />
            </div>
          </TabsContent>
          <TabsContent value="groups" className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Group sessions are logged once for a whole group and stay separate from the people totals.
              {canLogGroupTime(groupDepartments) ? (
                <>
                  {" "}
                  <Link href="/log/group" className="font-medium text-foreground underline underline-offset-4">
                    Log group time
                  </Link>
                </>
              ) : null}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={ClockIcon} label="Hours" value={formatNumber(report.collective.hours)} />
              <StatCard icon={HandCoinsIcon} tone="success" label="In-kind value" value={formatCurrency(report.collective.inKind)} />
              <StatCard icon={ListChecksIcon} tone="accent" label="Sessions" value={report.collective.entries} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <GroupTable title={`By ${copy.project.toLowerCase()}`} rows={report.collective.byProject} total={report.collective.hours} />
              <GroupTable title={`By ${copy.department.toLowerCase()}`} rows={report.collective.byDepartment} total={report.collective.hours} />
              <GroupTable title={`By ${copy.taskCategory.toLowerCase()}`} rows={report.collective.byCategory} total={report.collective.hours} />
            </div>
          </TabsContent>
          <TabsContent value="staff" className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Paid staff hours use a professional rate and stay out of volunteer grant totals.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={ClockIcon} label="Staff hours" value={formatNumber(report.staff.hours)} />
              <StatCard icon={HandCoinsIcon} tone="success" label="In-kind value" value={formatCurrency(report.staff.inKind)} />
              <StatCard icon={UsersIcon} tone="highlight" label="Staff" value={report.staff.volunteers} />
              <StatCard icon={ListChecksIcon} tone="accent" label="Entries" value={report.staff.entries} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <GroupTable title={`By ${copy.department.toLowerCase()}`} rows={report.staff.byDepartment} total={report.staff.hours} />
              <GroupTable title={`By ${copy.project.toLowerCase()}`} rows={report.staff.byProject} total={report.staff.hours} />
              <GroupTable title="By person" rows={report.staff.byPerson} total={report.staff.hours} />
            </div>
          </TabsContent>
        </Tabs>
      ) : null}
    </>
  );
}
