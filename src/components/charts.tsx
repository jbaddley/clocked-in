"use client";

import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { chartColor } from "@/lib/brand";
import { formatCurrency, formatHours, formatNumber } from "@/lib/format";
import type { ReportGroup } from "@/lib/types";

function configFor(rows: ReportGroup[]): ChartConfig {
  return Object.fromEntries(rows.map((row, index) => [row.id, { label: row.label, color: chartColor(index) }]));
}

export function HoursDonut({ rows, total }: { rows: ReportGroup[]; total: number }) {
  const data = rows.slice(0, 8).map((row, index) => ({ ...row, fill: chartColor(index) }));
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <ChartContainer config={configFor(rows)} className="aspect-square w-full max-w-[220px] shrink-0">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="id" />} />
          <Pie data={data} dataKey="hours" nameKey="id" innerRadius="62%" strokeWidth={2}>
            {data.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            <Label
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                      {formatNumber(total)}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                      hours
                    </tspan>
                  </text>
                ) : null
              }
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex w-full min-w-0 flex-col gap-2 text-sm">
        {data.map((row) => (
          <li key={row.id} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: row.fill }} />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <span className="text-muted-foreground tabular-nums">{formatHours(row.hours)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HoursBars({ rows }: { rows: ReportGroup[] }) {
  return <SummaryBars rows={rows} />;
}

export function SummaryBars({
  rows,
  valueKey = "hours",
  format = "hours",
  orientation = "horizontal",
}: {
  rows: ReportGroup[];
  valueKey?: "hours" | "inKind";
  format?: "hours" | "currency";
  orientation?: "horizontal" | "vertical";
}) {
  const data = rows.map((row, index) => ({ ...row, fill: chartColor(index) }));
  const tick = (value: number) => (format === "currency" ? formatCurrency(value) : formatNumber(value));
  const categoryWidth = Math.min(160, Math.max(88, ...data.map((row) => Math.min(row.label.length * 7, 160))));
  const horizontal = orientation === "horizontal";

  return (
    <ChartContainer config={configFor(rows)} className="aspect-auto h-64 w-full">
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={horizontal ? { left: 0, right: 12 } : { left: 8, right: 8, top: 8 }}
      >
        <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <YAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              width={categoryWidth}
              tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value)}
            />
            <XAxis type="number" dataKey={valueKey} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={tick} />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              type="category"
              tickLine={false}
              axisLine={false}
              interval={0}
              tickFormatter={(value: string) => (value.length > 10 ? `${value.slice(0, 9)}…` : value)}
            />
            <YAxis type="number" dataKey={valueKey} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={tick} width={64} />
          </>
        )}
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="id"
              formatter={(value) => (format === "currency" ? formatCurrency(Number(value)) : formatHours(Number(value)))}
            />
          }
        />
        <Bar dataKey={valueKey} radius={6}>
          {data.map((row) => (
            <Cell key={row.id} fill={row.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
