"use client";

import { brandAssetSrc } from "@/lib/brand";
import { downloadBlob } from "@/lib/download";
import type { ChartPaletteSource } from "@/lib/chart-palette";
import type { ReportCard, ReportFilters } from "@/lib/report-layout";
import { paginatePdfBlocks, reportPdfBlocks } from "./blocks";
import { capturePdfCharts } from "./capture";
import { reportPdfFilename } from "./filename";
import { pageContentHeight } from "./layout";
import type { Organization } from "@/lib/types";

export type ReportPdfInput = {
  title: string;
  slug: string;
  organization: Pick<Organization, "name" | "markUrl" | "theme">;
  filters: ReportFilters;
  filterSummary: string;
  cards: ReportCard[];
  data: unknown;
};

async function fetchDataUrl(src: string) {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function themeColors(theme: ChartPaletteSource & { primary: string; foreground: string }) {
  return {
    primary: theme.primary,
    foreground: theme.foreground,
    muted: "#4a4a4a",
    line: "#e5e5e5",
  };
}

export async function downloadReportPdf(input: ReportPdfInput) {
  const captured = await capturePdfCharts(reportPdfBlocks(input.cards, input.data, input.organization.theme));
  const blocks = paginatePdfBlocks(captured, pageContentHeight - 80).flat();
  const logoSrc = brandAssetSrc("mark", input.organization.markUrl);
  const logo = logoSrc ? await fetchDataUrl(logoSrc) : null;
  const [{ pdf }, { ReportPdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./document"),
  ]);
  const blob = await pdf(
    <ReportPdfDocument
      title={input.title}
      organizationName={input.organization.name}
      logoSrc={logo}
      filterSummary={input.filterSummary}
      blocks={blocks}
      colors={themeColors(input.organization.theme)}
    />,
  ).toBlob();
  downloadBlob(reportPdfFilename(input.slug, input.filters), blob, "application/pdf");
}
