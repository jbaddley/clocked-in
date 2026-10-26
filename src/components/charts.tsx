"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, Text, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { seriesColor, type ChartType } from "@/lib/chart-palette";
import { abbreviateChartLabel } from "@/lib/format";
import { formatWithPattern } from "@/lib/number-pattern";
import type { ReportGroup } from "@/lib/types";

function configFor(rows: ReportGroup[], colors: string[]): ChartConfig {
  return Object.fromEntries(
    rows.map((row, index) => [row.id, { label: row.label, color: seriesColor(colors, index) }]),
  );
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
  valueKey,
  pattern,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ReportGroup }>;
  valueKey: "hours" | "inKind";
  pattern: string;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  const exact = formatWithPattern(row[valueKey], pattern);
  return (
    <div className="grid min-w-32 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{row.label}</div>
      <div className="font-medium tabular-nums">{exact}</div>
    </div>
  );
}

export function ChartPlot({
  rows,
  chartType,
  colors,
  valueKey = "hours",
  pattern,
}: {
  rows: ReportGroup[];
  chartType: ChartType;
  colors: string[];
  valueKey?: "hours" | "inKind";
  pattern: string;
}) {
  if (chartType === "donut" || chartType === "pie") {
    return <ArcChart rows={rows} colors={colors} valueKey={valueKey} pattern={pattern} donut={chartType === "donut"} />;
  }

  return (
    <SummaryBars
      rows={rows}
      colors={colors}
      valueKey={valueKey}
      pattern={pattern}
      orientation={chartType === "bar" ? "horizontal" : "vertical"}
    />
  );
}

function ArcChart({
  rows,
  colors,
  valueKey,
  pattern,
  donut,
}: {
  rows: ReportGroup[];
  colors: string[];
  valueKey: "hours" | "inKind";
  pattern: string;
  donut: boolean;
}) {
  const data = rows.map((row, index) => ({ ...row, fill: seriesColor(colors, index) }));
  const total = data.reduce((sum, row) => sum + row[valueKey], 0);
  const totalLabel = formatWithPattern(total, pattern);
  const caption = valueKey === "inKind" ? "in-kind" : "hours";
  const valueLabel = (value: number) => formatWithPattern(value, pattern);

  return (
    <div className="flex h-full min-h-56 w-full flex-1 flex-col items-center justify-center gap-4 sm:flex-row sm:items-center">
      <ChartContainer config={configFor(rows, colors)} className="aspect-square w-full max-w-56 shrink-0">
        <PieChart>
          <ChartTooltip cursor={false} content={<ValueTooltip valueKey={valueKey} pattern={pattern} />} />
          <Pie data={data} dataKey={valueKey} nameKey="id" innerRadius={donut ? "62%" : 0} strokeWidth={2}>
            {data.map((row) => (
              <Cell key={row.id} fill={row.fill} />
            ))}
            {donut ? (
              <Label
                content={({ viewBox }) =>
                  viewBox && "cx" in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                        {totalLabel}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                        {caption}
                      </tspan>
                    </text>
                  ) : null
                }
              />
            ) : null}
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="flex max-h-72 w-full min-w-0 flex-col gap-2 overflow-y-auto text-sm">
        {data.map((row) => (
          <li key={row.id} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: row.fill }} />
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            <span className="text-muted-foreground tabular-nums">{valueLabel(row[valueKey])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryBars({
  rows,
  colors,
  valueKey = "hours",
  pattern,
  orientation = "horizontal",
}: {
  rows: ReportGroup[];
  colors: string[];
  valueKey?: "hours" | "inKind";
  pattern: string;
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

  const data = rows.map((row, index) => ({ ...row, fill: seriesColor(colors, index) }));
  const horizontal = orientation === "horizontal";
  const valueAxisWidth = pattern.includes("$") ? 72 : 48;
  const categoryAxisWidth = 156;
  const measured = width || 420;
  const labelWidth = horizontal
    ? categoryAxisWidth - 16
    : Math.max(36, (measured - valueAxisWidth - 24) / Math.max(data.length, 1) - 8);
  const maxLines = Math.max(1, ...data.map((row) => estimateWrappedLines(row.label, labelWidth)));
  const xAxisSpace = maxLines * 15 + 10;
  const height = horizontal ? Math.max(200, data.length * (maxLines * 15 + 16) + 32) : 216 + xAxisSpace;
  const tickValue = (value: number) => formatWithPattern(value, pattern);

  return (
    <div ref={frame} className="flex h-full min-h-0 w-full flex-1 flex-col">
      <ChartContainer config={configFor(rows, colors)} className="aspect-auto h-full w-full flex-1" style={{ minHeight: height }}>
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
                tick={(props) => <CategoryTick {...props} width={labelWidth} textAnchor="end" verticalAnchor="middle" />}
              />
              <XAxis type="number" dataKey={valueKey} tickLine={false} axisLine={false} domain={[0, "auto"]} tickFormatter={tickValue} />
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
                tick={(props) => <CategoryTick {...props} width={labelWidth} textAnchor="middle" verticalAnchor="start" />}
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
          <ChartTooltip cursor={false} content={<ValueTooltip valueKey={valueKey} pattern={pattern} />} />
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
