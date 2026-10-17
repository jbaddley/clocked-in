import type { CSSProperties } from "react";
import type { ThemeJson } from "@/lib/api/features/themes";

export const brandFonts = ["SourceSans3", "NunitoSans", "Geist"] as const;

const fontVars: Record<string, string> = {
  SourceSans3: "var(--font-source-sans)",
  NunitoSans: "var(--font-nunito)",
  Geist: "var(--font-geist)",
};

export const clockedInTheme: ThemeJson = {
  id: "44444444-4444-4444-8444-444444444441",
  name: "Clocked In",
  organizationId: null,
  primary: "#001836",
  primaryForeground: "#FFFFFF",
  highlight: "#D4AC59",
  accent: "#FF5E9F",
  success: "#4EBFAE",
  surface: "#FFFFFF",
  surfaceForeground: "#001836",
  foreground: "#001836",
  headingFont: "SourceSans3",
  bodyFont: "NunitoSans",
  categoricalPalette: ["#001836", "#D4AC59", "#2A6F97", "#4EBFAE", "#C17B4A", "#6B7C93"],
  sequentialPalette: ["#F4F0E6", "#E8D7A8", "#D4AC59", "#8A6E2F", "#3D3014"],
  divergingPalette: ["#8B3A2A", "#C17B4A", "#E8C9A8", "#F7F4EE", "#A8C4D4", "#2A6F97", "#001836"],
};

const hexColor = /^#[0-9A-Fa-f]{6}$/;

export function brandCss(theme: ThemeJson | null) {
  const declarations = Object.entries(brandStyle(theme))
    .map(([key, value]) => `${key}:${value};`)
    .join("");
  return declarations ? `:root{${declarations}}` : "";
}

export function brandStyle(theme: ThemeJson | null): CSSProperties {
  if (!theme) {
    return {};
  }

  const colors = [
    theme.primary,
    theme.primaryForeground,
    theme.highlight,
    theme.accent,
    theme.success,
    theme.surface,
    theme.surfaceForeground,
    theme.foreground,
  ];
  if (!colors.every((color) => hexColor.test(color))) {
    return {};
  }

  const palette = theme.categoricalPalette.filter((color) => hexColor.test(color));
  const chartVars = Object.fromEntries(
    Array.from({ length: 8 }, (_, index) => [`--chart-${index + 1}`, palette[index] ?? palette[index % Math.max(palette.length, 1)] ?? theme.primary]),
  );

  return {
    "--primary": theme.primary,
    "--primary-foreground": theme.primaryForeground,
    "--ring": theme.primary,
    "--sidebar": theme.primary,
    "--sidebar-foreground": theme.primaryForeground,
    "--sidebar-primary": theme.highlight,
    "--sidebar-primary-foreground": theme.primary,
    "--sidebar-accent": `color-mix(in oklch, ${theme.primaryForeground} 12%, transparent)`,
    "--sidebar-accent-foreground": theme.primaryForeground,
    "--sidebar-border": `color-mix(in oklch, ${theme.primaryForeground} 14%, transparent)`,
    "--accent": theme.accent,
    "--highlight": theme.highlight,
    "--success": theme.success,
    "--card": theme.surface,
    "--popover": theme.surface,
    "--foreground": theme.foreground,
    "--card-foreground": theme.surfaceForeground,
    "--popover-foreground": theme.surfaceForeground,
    "--font-sans": fontVars[theme.bodyFont] ?? "var(--font-geist)",
    "--font-heading": fontVars[theme.headingFont] ?? "var(--font-geist)",
    ...chartVars,
  } as CSSProperties;
}

export function chartColor(index: number) {
  return `var(--chart-${(index % 8) + 1})`;
}
