"use client";

import { cloneElement, isValidElement, type ReactElement } from "react";
import { cn } from "cn";
import { getPath } from "@/lib/report-path";
import type { ReportGroup } from "@/lib/types";

export function ReportGridItem({
  column,
  row,
  columns,
  rows,
  accessor,
  data,
  cardId,
  editing = false,
  selected = false,
  title,
  className,
  children,
}: {
  column: number;
  row: number;
  columns: number;
  rows: number;
  accessor: string;
  data: unknown;
  cardId?: string;
  editing?: boolean;
  selected?: boolean;
  title?: string;
  className?: string;
  children: ReactElement<{ value?: unknown; rows?: ReportGroup[]; className?: string }>;
}) {
  const resolved = getPath(data, accessor);
  const series = (Array.isArray(resolved) ? resolved : []) as ReportGroup[];
  const value = Array.isArray(resolved) ? undefined : resolved;
  const child = isValidElement(children)
    ? cloneElement(children, { value, rows: series, className: cn("h-full w-full", children.props.className) })
    : children;

  return (
    <div
      data-card-id={cardId}
      style={{ gridColumn: `${column} / span ${columns}`, gridRow: `${row} / span ${rows}` }}
      className={cn("relative min-h-0 min-w-0", editing && "cursor-grab", selected && "rounded-xl ring-2 ring-primary", className)}
    >
      <div className="h-full min-h-0 w-full overflow-auto">{child}</div>
      {editing ? (
        <>
          <button
            type="button"
            data-resize="left"
            aria-label={`Resize ${title ?? "card"} from the left`}
            className="absolute top-3 bottom-3 left-0 z-10 w-2 cursor-col-resize rounded-full hover:bg-primary/50"
          />
          <button
            type="button"
            data-resize="right"
            aria-label={`Resize ${title ?? "card"} from the right`}
            className="absolute top-3 right-0 bottom-3 z-10 w-2 cursor-col-resize rounded-full hover:bg-primary/50"
          />
          <button
            type="button"
            data-resize="top"
            aria-label={`Resize ${title ?? "card"} from the top`}
            className="absolute top-0 right-3 left-3 z-10 h-2 cursor-row-resize rounded-full hover:bg-primary/50"
          />
          <button
            type="button"
            data-resize="bottom"
            aria-label={`Resize ${title ?? "card"} from the bottom`}
            className="absolute right-3 bottom-0 left-3 z-10 h-2 cursor-row-resize rounded-full hover:bg-primary/50"
          />
        </>
      ) : null}
    </div>
  );
}
