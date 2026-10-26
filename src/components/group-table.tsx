"use client";

import { cn } from "cn";
import { DataTable, type Column } from "@/components/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countPattern, formatWithPattern, moneyPattern } from "@/lib/number-pattern";
import { listColumnLabel, type ListColumn } from "@/lib/report-layout";
import { share } from "@/lib/format";
import type { ReportGroup } from "@/lib/types";

function NumberCell({ value, pattern }: { value: number; pattern: string }) {
  return <span className="tabular-nums">{formatWithPattern(value, pattern)}</span>;
}

export function GroupTable({
  title,
  description,
  rows,
  visibleColumns,
  hoursPattern,
  className,
}: {
  title: string;
  description?: string;
  rows: ReportGroup[];
  visibleColumns: ListColumn[];
  hoursPattern: string;
  className?: string;
}) {
  const shown = new Set(visibleColumns);
  const total = rows.reduce((sum, row) => sum + row.hours, 0);
  const columns: Column<ReportGroup>[] = [];

  if (shown.has("name")) {
    columns.push({
      key: "label",
      header: listColumnLabel("name"),
      primary: true,
      wrap: true,
      cell: (row) => <span className="font-medium">{row.label}</span>,
    });
  }
  if (shown.has("type")) {
    columns.push({
      key: "projectType",
      header: listColumnLabel("type"),
      cell: (row) => row.projectType ?? "—",
    });
  }
  if (shown.has("hours")) {
    columns.push({
      key: "hours",
      header: listColumnLabel("hours"),
      align: "right",
      cell: (row) => <NumberCell value={row.hours} pattern={hoursPattern} />,
    });
  }
  if (shown.has("share")) {
    columns.push({
      key: "share",
      header: listColumnLabel("share"),
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
    });
  }
  if (shown.has("people")) {
    columns.push({
      key: "volunteers",
      header: listColumnLabel("people"),
      align: "right",
      cell: (row) => <NumberCell value={row.volunteers} pattern={countPattern} />,
    });
  }
  if (shown.has("inKind")) {
    columns.push({
      key: "inKind",
      header: listColumnLabel("inKind"),
      align: "right",
      cell: (row) => <NumberCell value={row.inKind} pattern={moneyPattern} />,
    });
  }

  return (
    <Card className={cn("h-full gap-2", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-auto">
        {columns.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Choose a column to show.</p>
        ) : rows.length ? (
          <DataTable rows={rows} columns={columns} rowKey={(row) => row.id} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">No hours in this period.</p>
        )}
      </CardContent>
    </Card>
  );
}
