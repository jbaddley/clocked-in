import { cn } from "cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  width?: string;
  wrap?: boolean;
  primary?: boolean;
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const rest = columns.filter((column) => column !== primary);

  return (
    <div className={className}>
      <div className="hidden md:block">
        <Table className="table-fixed">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "text-xs font-medium tracking-wide whitespace-normal text-muted-foreground uppercase",
                    column.align === "right" && "text-right",
                    column.className,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={rowKey(row)}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === "right" && "text-right tabular-nums",
                      column.wrap && "whitespace-normal break-words",
                      column.className,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn("flex flex-col gap-2 py-3", onRowClick && "cursor-pointer")}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            <div className="font-medium">{primary.cell(row)}</div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {rest.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-muted-foreground">{column.header}</dt>
                  <dd className="text-right tabular-nums">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
