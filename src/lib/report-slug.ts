import type { ReportTemplateId } from "@/lib/report-layout";

export const reportIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const standardReports = [
  { slug: "summary", key: "summary", label: "Summary" },
  { slug: "people", key: "people", label: "People" },
  { slug: "group-sessions", key: "groups", label: "Group sessions" },
  { slug: "staff", key: "staff", label: "Staff" },
] as const satisfies ReadonlyArray<{ slug: string; key: ReportTemplateId; label: string }>;

export type StandardReportSlug = (typeof standardReports)[number]["slug"];

const standardSlugAliases: Record<string, StandardReportSlug> = {
  groups: "group-sessions",
  standard: "summary",
};

const reservedSlugs = new Set<string>([
  "new",
  "standard",
  "templates",
  "design",
  "groups",
  ...standardReports.map((item) => item.slug),
]);

export function isReportId(value: string) {
  return reportIdPattern.test(value);
}

export function isStandardSlug(slug: string): slug is StandardReportSlug {
  return standardReports.some((item) => item.slug === slug);
}

export function canonicalStandardSlug(slug: string): StandardReportSlug | null {
  if (isStandardSlug(slug)) return slug;
  return standardSlugAliases[slug] ?? null;
}

export function standardSlugForKey(key: string | null | undefined) {
  return standardReports.find((item) => item.key === key)?.slug ?? null;
}

export function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "report";
}

export function slugForSavedReport(name: string) {
  const base = slugify(name);
  return reservedSlugs.has(base) ? `${base}-2` : base;
}

export function reportPath(slug: string, search?: URLSearchParams | string | null) {
  const query = typeof search === "string" ? search : (search?.toString() ?? "");
  return query ? `/reports/${slug}?${query}` : `/reports/${slug}`;
}

export function lastReportStorageKey(organizationId: string) {
  return `clocked-in.last-report:${organizationId}`;
}

export function isReportViewerPath(pathname: string) {
  if (pathname === "/reports") return true;
  if (pathname === "/reports/new" || pathname === "/reports/standard") return false;
  if (pathname.startsWith("/reports/templates/")) return false;
  if (/^\/reports\/[^/]+\/design$/.test(pathname)) return false;
  return /^\/reports\/[^/]+$/.test(pathname);
}

export function viewerSlug(pathname: string) {
  if (pathname === "/reports") return null;
  const match = /^\/reports\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
}
