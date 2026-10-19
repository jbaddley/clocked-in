"use client";

import { DataTable, type Column } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCompactCurrency, formatCompactNumber, formatCurrency, formatNumber, share } from "@/lib/format";
import type { ReportGroup } from "@/lib/types";

function columnWidths(showType: boolean, showVolunteers: boolean): Record<string, string> {
  if (showType && showVolunteers) {
    return { label: "26%", projectType: "12%", hours: "12%", share: "22%", volunteers: "13%", inKind: "15%" };
  }

  if (showType) {
    return { label: "28%", projectType: "13%", hours: "16%", share: "24%", inKind: "19%" };
  }

  if (showVolunteers) {
    return { label: "30%", hours: "14%", share: "24%", volunteers: "14%", inKind: "18%" };
  }

  return { label: "36%", hours: "18%", share: "26%", inKind: "20%" };
}

function ExactNumber({ value, currency = false }: { value: number; currency?: boolean }) {
  const exact = currency ? formatCurrency(value) : formatNumber(value);
  const compact = currency ? formatCompactCurrency(value) : formatCompactNumber(value);
  if (compact === exact) {
    return <span className="tabular-nums">{exact}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="cursor-help border-0 bg-transparent p-0 font-inherit text-inherit tabular-nums underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
            aria-label={exact}
          />
        }
      >
        {compact}
      </TooltipTrigger>
      <TooltipContent>{exact}</TooltipContent>
    </Tooltip>
  );
}

export function GroupTable({
  title,
  rows,
  total,
  showVolunteers = false,
}: {
  title: string;
  rows: ReportGroup[];
  total: number;
  showVolunteers?: boolean;
}) {
  const showType = rows.some((row) => row.projectType);
  const width = columnWidths(showType, showVolunteers);
  const columns: Column<ReportGroup>[] = [
    {
      key: "label",
      header: "Name",
      primary: true,
      width: width.label,
      wrap: true,
      cell: (row) => <span className="font-medium">{row.label}</span>,
    },
    ...(showType
      ? [
          {
            key: "projectType",
            header: "Type",
            width: width.projectType,
            cell: (row: ReportGroup) => row.projectType ?? "—",
          },
        ]
      : []),
    {
      key: "hours",
      header: "Hours",
      align: "right",
      width: width.hours,
      cell: (row) => <ExactNumber value={row.hours} />,
    },
    {
      key: "share",
      header: "Share",
      width: width.share,
      cell: (row) => {
        const percent = share(row.hours, total);
        return (
          <div className="flex w-full min-w-0 items-center gap-2">
            <div className="h-2 min-w-6 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
          </div>
        );
      },
    },
    ...(showVolunteers
      ? [
          {
            key: "volunteers",
            header: "People",
            align: "right" as const,
            width: width.volunteers,
            cell: (row: ReportGroup) => <ExactNumber value={row.volunteers} />,
          },
        ]
      : []),
    {
      key: "inKind",
      header: "In-kind",
      align: "right",
      width: width.inKind,
      cell: (row) => <ExactNumber value={row.inKind} currency />,
    },
  ];

  return (
    <Card className="gap-2">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <DataTable rows={rows} columns={columns} rowKey={(row) => row.id} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No hours in this period.</p>
        )}
      </CardContent>
    </Card>
  );
}
