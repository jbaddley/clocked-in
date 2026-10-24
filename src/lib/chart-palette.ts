const hexColor = /^#[0-9A-Fa-f]{6}$/;

export const chartTypes = ["donut", "pie", "bar", "column"] as const;
export type ChartType = (typeof chartTypes)[number];

export const paletteTypes = ["single", "categorical", "sequential", "diverging"] as const;
export type PaletteType = (typeof paletteTypes)[number];

export type ChartPaletteSource = {
  chartColor: string;
  categoricalPalette: string[];
  sequentialPalette: string[];
  divergingPalette: string[];
};

const chartTypeLabels: Record<ChartType, string> = {
  donut: "Donut",
  pie: "Pie",
  bar: "Horizontal bar",
  column: "Vertical bar",
};

const paletteTypeLabels: Record<PaletteType, string> = {
  single: "Single color",
  categorical: "Categorical",
  sequential: "Sequential",
  diverging: "Diverging",
};

export function isChartType(value: string): value is ChartType {
  return (chartTypes as readonly string[]).includes(value);
}

export function isPaletteType(value: string): value is PaletteType {
  return (paletteTypes as readonly string[]).includes(value);
}

export function isArcChart(type: ChartType) {
  return type === "donut" || type === "pie";
}

export function chartTypeLabel(type: ChartType) {
  return chartTypeLabels[type];
}

export function paletteTypeLabel(type: PaletteType) {
  return paletteTypeLabels[type];
}

/** Pie and donut charts always draw from a multi-color palette. */
export function paletteForChart(type: ChartType, palette: PaletteType): PaletteType {
  if (isArcChart(type) && palette === "single") return "categorical";
  return palette;
}

export function defaultPalette(type: ChartType, palette?: PaletteType): PaletteType {
  return paletteForChart(type, palette ?? (isArcChart(type) ? "categorical" : "single"));
}

export function colorsForPalette(theme: ChartPaletteSource, palette: PaletteType) {
  const colors =
    palette === "single"
      ? [theme.chartColor]
      : palette === "categorical"
        ? theme.categoricalPalette
        : palette === "sequential"
          ? theme.sequentialPalette
          : theme.divergingPalette;
  const valid = colors.filter((color) => hexColor.test(color));
  if (valid.length > 0) return valid;
  return hexColor.test(theme.chartColor) ? [theme.chartColor] : ["#001836"];
}

export function seriesColor(colors: string[], index: number) {
  return colors[index % colors.length] ?? colors[0] ?? "#001836";
}
