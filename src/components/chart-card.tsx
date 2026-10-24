"use client";

import { useState } from "react";
import { MoreVerticalIcon } from "lucide-react";
import { cn } from "cn";
import { ChartPlot } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization } from "@/hooks/use-workspace";
import {
  chartTypes,
  chartTypeLabel,
  colorsForPalette,
  defaultPalette,
  isChartType,
  isPaletteType,
  paletteForChart,
  paletteTypeLabel,
  paletteTypes,
  type ChartType,
  type PaletteType,
} from "@/lib/chart-palette";
import type { ReportGroup } from "@/lib/types";

export type { ChartType, PaletteType };

export function ChartCard({
  title,
  description,
  rows,
  chartType: chartTypeProp = "bar",
  palette: paletteProp,
  valueKey = "hours",
  format = "hours",
  empty = "No hours in this range.",
  className,
}: {
  title: string;
  description?: string;
  rows: ReportGroup[];
  chartType?: ChartType;
  palette?: PaletteType;
  valueKey?: "hours" | "inKind";
  format?: "hours" | "currency";
  empty?: string;
  className?: string;
}) {
  const { theme } = useOrganization();
  const [chartType, setChartType] = useState(chartTypeProp);
  const [palette, setPalette] = useState<PaletteType>(() => defaultPalette(chartTypeProp, paletteProp));
  const activePalette = paletteForChart(chartType, palette);
  const colors = colorsForPalette(theme, activePalette);
  const paletteChoices = paletteTypes.filter((type) => paletteForChart(chartType, type) === type);

  return (
    <Card className={cn("h-full w-full", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Chart options for ${title}`} />}
            >
              <MoreVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 min-w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Chart type</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={chartType}
                  onValueChange={(value) => {
                    if (!isChartType(value)) return;
                    setChartType(value);
                    setPalette((current) => paletteForChart(value, current));
                  }}
                >
                  {chartTypes.map((type) => (
                    <DropdownMenuRadioItem key={type} value={type}>
                      {chartTypeLabel(type)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Color palette</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={activePalette}
                  onValueChange={(value) => {
                    if (!isPaletteType(value)) return;
                    setPalette(paletteForChart(chartType, value));
                  }}
                >
                  {paletteChoices.map((type) => (
                    <DropdownMenuRadioItem key={type} value={type} className="gap-2.5">
                      <PaletteSwatch colors={colorsForPalette(theme, type)} />
                      {paletteTypeLabel(type)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {rows.length ? (
          <ChartPlot rows={rows} chartType={chartType} colors={colors} valueKey={valueKey} format={format} />
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PaletteSwatch({ colors }: { colors: string[] }) {
  return (
    <span className="flex w-24 shrink-0 gap-0.5" aria-hidden>
      {colors.slice(0, 8).map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="h-3.5 min-w-1.5 flex-1 rounded-[3px] ring-1 ring-foreground/10"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}
