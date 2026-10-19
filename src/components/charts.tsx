"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, Text, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { chartColor, chartColorCount } from "@/lib/brand";
import { abbreviateChartLabel, formatCompactCurrency, formatCompactNumber, formatCurrency, formatHours, formatNumber } from "@/lib/format";
import type { ReportGroup } from "@/lib/types";

function configFor(rows: ReportGroup[]): ChartConfig {
  return Object.fromEntries(rows.map((row, index) => [row.id, { label: row.label, color: chartColor(index) }]));
}

export function HoursDonut({ rows, total }: { rows: ReportGroup[]; total: number }) {
  const data = rows.slice(0, chartColorCount).map((row, index) => ({ ...row, fill: chartColor(index) }));
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

function estimateWrappedLines(label: string, width: number) {
  const text = abbreviateChartLabel(label);
  const chars = Math.max(6, Math.floor(width / 6.7));
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let used = 0;
  for (const word of words) {
    if (used === 0) {
      used = word.length;
      continue;
    }

    if (used + 1 + word.length > chars) {
      lines += 1;
      used = word.length;
    } else {
      used += 1 + word.length;
    }
  }

  return Math.min(4, lines);
}

function CategoryTick({
  x = 0,
  y = 0,
  payload,
  width,
  textAnchor,
  verticalAnchor,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: unknown };
  width: number;
  textAnchor: "end" | "middle";
  verticalAnchor: "middle" | "start";
}) {
  return (
    <Text
      x={x}
      y={y}
      width={Math.max(24, width)}
      textAnchor={textAnchor}
      verticalAnchor={verticalAnchor}
      maxLines={4}
      fontSize={12}
      lineHeight="1.15em"
      fill="var(--muted-foreground)"
    >
      {abbreviateChartLabel(String(payload?.value ?? ""))}
    </Text>
  );
}

function ValueTooltip({
  active,
  payload,
  format,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ReportGroup }>;
  format: "hours" | "currency";
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const exact = format === "currency" ? formatCurrency(row.inKind) : formatNumber(row.hours);
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.label}</div>
      <div className="font-medium tabular-nums">{exact}</div>
    </div>
  );
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
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;

    const measure = () => setWidth(node.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const data = rows.map((row, index) => ({ ...row, fill: chartColor(index) }));
  const horizontal = orientation === "horizontal";
  const valueAxisWidth = format === "currency" ? 58 : 42;
  const categoryAxisWidth = 156;
  const measured = width || 420;
  const labelWidth = horizontal
    ? categoryAxisWidth - 16
    : Math.max(36, (measured - valueAxisWidth - 24) / Math.max(data.length, 1) - 8);
  const maxLines = Math.max(1, ...data.map((row) => estimateWrappedLines(row.label, labelWidth)));
  const xAxisSpace = maxLines * 15 + 10;
  const height = horizontal ? Math.max(200, data.length * (maxLines * 15 + 16) + 32) : 216 + xAxisSpace;
  const tickValue = (value: number) => {
    if (format === "currency") return value === 0 ? "$0" : formatCompactCurrency(value);
    return formatCompactNumber(value);
  };

  return (
    <div ref={frame}>
      <ChartContainer config={configFor(rows)} className="aspect-auto w-full" style={{ height }}>
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={horizontal ? { top: 4, right: 12, bottom: 4, left: 0 } : { top: 8, right: 8, bottom: xAxisSpace, left: 0 }}
        >
          <CartesianGrid horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                interval={0}
                width={categoryAxisWidth}
                tickMargin={8}
                tick={(props) => (
                  <CategoryTick {...props} width={labelWidth} textAnchor="end" verticalAnchor="middle" />
                )}
              />
              <XAxis
                type="number"
                dataKey={valueKey}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
                tickFormatter={tickValue}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                interval={0}
                tickMargin={8}
                tick={(props) => (
                  <CategoryTick {...props} width={labelWidth} textAnchor="middle" verticalAnchor="start" />
                )}
              />
              <YAxis
                type="number"
                dataKey={valueKey}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
                width={valueAxisWidth}
                tickMargin={4}
                tickFormatter={tickValue}
              />
            </>
          )}
          <ChartTooltip cursor={false} content={<ValueTooltip format={format} />} />
          <Bar dataKey={valueKey} radius={6} maxBarSize={28}>
            {data.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}
