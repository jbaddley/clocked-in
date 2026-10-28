"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { CardSkeleton, StatsSkeleton } from "@/components/skeletons";
import { useLabels } from "@/hooks/use-labels";
import { useReport } from "@/hooks/use-report";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { useOrganization } from "@/hooks/use-workspace";
import type { ReportTemplate } from "@/lib/api/features/report-templates";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import type { EntityLabels } from "@/lib/labels";
import { reportTemplatesQuery } from "@/lib/queries";
import { builtinTemplateIds, reportTemplate, type ReportCard } from "@/lib/report-layout";
import {
  canonicalStandardSlug,
  isReportId,
  lastReportStorageKey,
  reportPath,
  slugForSavedReport,
  standardReports,
  viewerSlug,
} from "@/lib/report-slug";
import { listedSavedReports, ReportMenu } from "./report-menu";
import { ReportFilters, reportFiltersFromSearch } from "./report-filters";

type ResolvedReport = {
  slug: string;
  cards: ReportCard[];
  editHref: string | null;
};

function readLastSlug(organizationId: string) {
  try {
    return window.localStorage.getItem(lastReportStorageKey(organizationId));
  } catch {
    return null;
  }
}

function writeLastSlug(organizationId: string, slug: string) {
  try {
    window.localStorage.setItem(lastReportStorageKey(organizationId), slug);
  } catch {
    return;
  }
}

function slugStillExists(slug: string, reports: SavedReport[]) {
  if (canonicalStandardSlug(slug)) return true;
  return reports.some((report) => slugForSavedReport(report.name) === slug);
}

function defaultSlug(reports: SavedReport[]) {
  const selected = reports.find((report) => report.isDefault);
  return selected ? slugForSavedReport(selected.name) : "summary";
}

function resolveStandard(
  slug: string,
  templates: ReportTemplate[],
  copy: EntityLabels,
): ResolvedReport | null {
  const spec = standardReports.find((item) => item.slug === slug);
  if (!spec) return null;
  const saved = templates.find((item) => item.key === spec.key);
  if (saved) {
    return {
      slug,
      cards: saved.layout.cards,
      editHref: `/reports/templates/${saved.id}/design`,
    };
  }
  return {
    slug,
    cards: reportTemplate(spec.key, copy).cards,
    editHref: `/reports/templates/${builtinTemplateIds[spec.key]}/design`,
  };
}

function resolveCustom(slug: string, reports: SavedReport[]): ResolvedReport | null {
  const report = reports.find((item) => slugForSavedReport(item.name) === slug || item.id === slug);
  if (!report) return null;
  return {
    slug: slugForSavedReport(report.name),
    cards: report.layout.cards,
    editHref: `/reports/${slugForSavedReport(report.name)}/design`,
  };
}

export function ReportWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const organization = useOrganization();
  const copy = useLabels();
  const slug = viewerSlug(pathname ?? "");
  const filters = reportFiltersFromSearch(search);
  const { reports, isPending: reportsPending } = useSavedReports();
  const listed = useMemo(() => listedSavedReports(reports), [reports]);
  const templates = useQuery({
    ...reportTemplatesQuery(organization.id),
    enabled: Boolean(organization.id),
  });
  const { data: report, isFetching, isPending } = useReport(filters);
  const query = search.toString();

  const canonical = slug ? canonicalStandardSlug(slug) : null;
  const uuidReport = slug && isReportId(slug) ? reports.find((item) => item.id === slug) : null;
  const resolved = useMemo(() => {
    if (!slug) return null;
    return resolveStandard(slug, templates.data ?? [], copy) ?? resolveCustom(slug, listed);
  }, [copy, listed, slug, templates.data]);

  useEffect(() => {
    if (!organization.id) return;

    if (!slug) {
      if (reportsPending) return;
      const last = readLastSlug(organization.id);
      const next = last && slugStillExists(last, listed) ? last : defaultSlug(listed);
      router.replace(reportPath(next, query), { scroll: false });
      return;
    }

    if (canonical && canonical !== slug) {
      router.replace(reportPath(canonical, query), { scroll: false });
      return;
    }

    if (uuidReport) {
      const next = slugForSavedReport(uuidReport.name);
      if (next !== slug) {
        router.replace(reportPath(next, query), { scroll: false });
      }
      return;
    }

    if (resolved) {
      writeLastSlug(organization.id, resolved.slug);
    }
  }, [canonical, listed, organization.id, query, reportsPending, resolved, router, slug, uuidReport]);

  const waitingForRedirect =
    !slug || Boolean(canonical && canonical !== slug) || Boolean(uuidReport && slugForSavedReport(uuidReport.name) !== slug);
  const waitingForLayout = Boolean(slug) && !resolved && (reportsPending || templates.isPending);
  const missing = Boolean(slug) && !waitingForRedirect && !waitingForLayout && !resolved;
  const showSkeleton = waitingForRedirect || waitingForLayout || (isPending && !report);

  return (
    <>
      <PageHeader
        actions={
          <div className="flex w-full flex-wrap items-center gap-2">
            <ReportFilters filters={filters} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {isFetching ? <span className="text-xs text-muted-foreground">Updating…</span> : null}
              <ReportMenu
                active={resolved?.slug ?? null}
                filters={filters}
                editHref={resolved?.editHref}
                cards={resolved?.cards ?? []}
                data={report}
              />
            </div>
          </div>
        }
      />
      {showSkeleton ? (
        <>
          <StatsSkeleton />
          <div className="grid gap-6 xl:grid-cols-2">
            <CardSkeleton rows={5} />
            <CardSkeleton rows={5} />
          </div>
        </>
      ) : missing ? (
        <p className="text-sm text-muted-foreground">That report is not available.</p>
      ) : resolved ? (
        <ReportGrid cards={resolved.cards} data={report} filters={filters} />
      ) : null}
    </>
  );
}
