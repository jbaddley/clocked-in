import { formatHours, share } from "@/lib/format";
import type { ReportGroup } from "@/lib/types";

const colors = Array.from({ length: 8 }, (_, index) => `var(--chart-${index + 1})`);

export function ShareBar({ rows, total }: { rows: ReportGroup[]; total: number }) {
  const top = rows.slice(0, 4);
  const rest = rows.slice(4).reduce((sum, row) => sum + row.hours, 0);
  const segments = rest > 0 ? [...top, { id: "other", label: "Other", hours: rest }] : top;

  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
      {segments.map((row, index) => {
        const percent = share(row.hours, total);
        return (
          <div key={row.id} className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{row.label}</p>
            <p className="text-2xl font-semibold tabular-nums" style={{ color: colors[index % colors.length] }}>
              {percent}%
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${percent}%`, background: colors[index % colors.length] }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">{formatHours(row.hours)}</p>
          </div>
        );
      })}
    </div>
  );
}
