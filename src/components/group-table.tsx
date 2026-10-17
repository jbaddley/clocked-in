import { DataTable, type Column } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatHours, share } from "@/lib/format";
import type { ReportGroup } from "@/lib/types";

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
  const columns: Column<ReportGroup>[] = [
    { key: "label", header: "Name", primary: true, cell: (row) => <span className="font-medium">{row.label}</span> },
    { key: "hours", header: "Hours", align: "right", cell: (row) => formatHours(row.hours) },
    {
      key: "share",
      header: "Share",
      className: "w-40",
      cell: (row) => {
        const percent = share(row.hours, total);
        return (
          <div className="flex items-center justify-end gap-2 md:justify-start">
            <div className="hidden h-2 flex-1 overflow-hidden rounded-full bg-muted md:block">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{percent}%</span>
          </div>
        );
      },
    },
    ...(showVolunteers
      ? [{ key: "volunteers", header: "People", align: "right" as const, cell: (row: ReportGroup) => row.volunteers }]
      : []),
    { key: "inKind", header: "In-kind", align: "right", cell: (row) => formatCurrency(row.inKind) },
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
