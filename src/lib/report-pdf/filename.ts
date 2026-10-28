import type { ReportFilters } from "@/lib/report-layout";

export function reportPdfFilename(slug: string, filters: ReportFilters) {
  if (filters.from && filters.to) return `${slug}-${filters.from}-${filters.to}.pdf`;
  if (filters.from) return `${slug}-from-${filters.from}.pdf`;
  if (filters.to) return `${slug}-to-${filters.to}.pdf`;
  return `${slug}-all-time.pdf`;
}
