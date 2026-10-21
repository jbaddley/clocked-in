"use client";

import { ArrowRightIcon, ClockIcon, HandCoinsIcon, InboxIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { HoursBars, HoursDonut } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { EntryList, EntryRow } from "@/components/entry-row";
import { ShareBar } from "@/components/share-bar";
import { StatCard } from "@/components/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEntries } from "@/hooks/use-entries";
import { useLabels } from "@/hooks/use-labels";
import { useReport } from "@/hooks/use-report";
import { DashboardSkeleton } from "@/components/skeletons";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatCurrency, formatHours, formatNumber, toDateOnly } from "@/lib/format";
import { canLogGroupTime, canSeeReports } from "@/lib/roles";

function weekStart() {
  const now = new Date();
  now.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return toDateOnly(now);
}

export function DashboardView() {
  const workspace = useWorkspace();
  const { viewer, groupDepartments } = workspace;
  const groupSessionsHref = canLogGroupTime(groupDepartments) ? "/log/group" : canSeeReports(workspace) ? "/reports" : null;
  const copy = useLabels();
  const week = weekStart();
  const { data: report, isPending } = useReport({});
  const { data: weekReport } = useReport({ from: week });
  const { entries } = useEntries(viewer.id, {});

  if (isPending) return <DashboardSkeleton />;
  if (!report) return null;
  const people = report.user;
  const mine = people.byPerson.find((row) => row.id === viewer.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClockIcon}
          label="Volunteer hours"
          value={formatNumber(people.hours)}
          hint={
            groupSessionsHref ? (
              <Link href={groupSessionsHref} className="underline-offset-2 hover:underline">
                {formatNumber(report.collective.hours)} more in group sessions
              </Link>
            ) : (
              `${formatNumber(report.collective.hours)} more in group sessions`
            )
          }
        />
        <StatCard icon={HandCoinsIcon} tone="success" label="In-kind value" value={formatCurrency(people.inKind)} hint="At your volunteer rate" />
        <StatCard icon={UsersIcon} tone="highlight" label="Volunteers" value={people.volunteers} hint={`${people.entries} entries logged`} />
        <StatCard
          icon={UserRoundIcon}
          tone="accent"
          label="Your hours"
          value={formatNumber(mine?.hours ?? 0)}
          hint={mine ? `${formatCurrency(mine.inKind)} in-kind` : "Log your first hours"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
          <CardDescription>Share of hours by {copy.project.toLowerCase()} since Monday</CardDescription>
          <CardAction className="text-right">
            <p className="text-xl font-semibold tabular-nums">{formatHours(weekReport?.user.hours ?? 0)}</p>
          </CardAction>
        </CardHeader>
        <CardContent>
          {weekReport && weekReport.user.hours > 0 ? (
            <ShareBar rows={weekReport.user.byProject} total={weekReport.user.hours} />
          ) : (
            <p className="text-sm text-muted-foreground">No hours logged this week yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hours by {copy.taskCategory.toLowerCase()}</CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            {people.byCategory.length ? (
              <HoursDonut rows={people.byCategory} total={people.hours} />
            ) : (
              <p className="text-sm text-muted-foreground">{copy.taskCategories} appear once time is logged.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hours by {copy.department.toLowerCase()}</CardTitle>
            <CardDescription>All time</CardDescription>
          </CardHeader>
          <CardContent>
            {people.byDepartment.length ? (
              <HoursBars rows={people.byDepartment} />
            ) : (
              <p className="text-sm text-muted-foreground">{copy.departments} appear once time is logged.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Your recent entries</CardTitle>
          <CardAction>
            <Link href="/entries" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
              <ArrowRightIcon />
            </Link>
          </CardAction>
        </CardHeader>
        {entries.length ? (
          <EntryList className="border-t">
            {entries.slice(0, 6).map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </EntryList>
        ) : (
          <CardContent className="pb-4">
            <EmptyState
              icon={InboxIcon}
              title="No entries yet"
              description="Start a timer or log hours you already worked."
              action={
                <Link href="/log/own" className={buttonVariants()}>
                  Log time
                </Link>
              }
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
