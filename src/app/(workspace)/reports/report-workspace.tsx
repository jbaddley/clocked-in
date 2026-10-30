"use client";

import { FileQuestionIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { PageSkeleton } from "@/components/skeletons";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useMembers } from "@/hooks/use-members";
import { useReport } from "@/hooks/use-report";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { useOrganization } from "@/hooks/use-workspace";
import type { ReportTemplate } from "@/lib/api/features/report-templates";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import type { EntityLabels } from "@/lib/labels";
import { reportTemplatesQuery } from "@/lib/queries";
import { personLabel, reportFilterSummary } from "@/lib/report-filter-summary";
import { builtinTemplateIds, filtersQuery, reportTemplate, type ReportCard } from "@/lib/report-layout";
import {
  canonicalStandardSlug,
  isReportId,
  lastReportStorageKey,
  reportPath,
  slugForSavedReport,
  standardReports,
  viewerSlug,
} from "@/lib/report-slug";
import { ReportMenu } from "./report-menu";
import { listedSavedReports } from "./report-switcher";
import { ReportFilters, reportFiltersFromSearch } from "./report-filters";
import { EmptyState } from "@/components/empty-state";

type ResolvedReport = {
  slug: string;
  title: string;
  cards: ReportCard[];
  editHref: string | null;
  saved: SavedReport | null;
  templateKey: string | null;
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

function resolveStandard(slug: string, templates: ReportTemplate[], copy: EntityLabels): ResolvedReport | null {
  const spec = standardReports.find((item) => item.slug === slug);
  if (!spec) return null;
  const saved = templates.find((item) => item.key === spec.key);
  if (saved) {
    return {
      slug,
      title: spec.label,
      cards: saved.layout.cards,
      editHref: `/reports/templates/${saved.id}/design`,
      saved: null,
      templateKey: spec.key,
    };
  }
  return {
    slug,
    title: spec.label,
    cards: reportTemplate(spec.key, copy).cards,
    editHref: `/reports/templates/${builtinTemplateIds[spec.key]}/design`,
    saved: null,
    templateKey: spec.key,
  };
}

function resolveCustom(slug: string, reports: SavedReport[]): ResolvedReport | null {
  const report = reports.find((item) => slugForSavedReport(item.name) === slug || item.id === slug);
  if (!report) return null;
  return {
    slug: slugForSavedReport(report.name),
    title: report.name,
    cards: report.layout.cards,
    editHref: `/reports/${slugForSavedReport(report.name)}/design`,
    saved: report,
    templateKey: null,
  };
}

export function ReportWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  const organization = useOrganization();
  const copy = useLabels();
  const { names } = useLookups();
  const { members } = useMembers();
  const slug = viewerSlug(pathname ?? "");
  const urlFilters = reportFiltersFromSearch(search);
  const { reports, isPending: reportsPending } = useSavedReports();
  const listed = useMemo(() => listedSavedReports(reports), [reports]);
  const templates = useQuery({
    ...reportTemplatesQuery(organization.id),
    enabled: Boolean(organization.id),
  });
  const query = search.toString();
  const [appliedFiltersFor, setAppliedFiltersFor] = useState<string | null>(null);

  const canonical = slug ? canonicalStandardSlug(slug) : null;
  const uuidReport = slug && isReportId(slug) ? reports.find((item) => item.id === slug) : null;
  const resolved = useMemo(() => {
    if (!slug) return null;
    return resolveStandard(slug, templates.data ?? [], copy) ?? resolveCustom(slug, listed);
  }, [copy, listed, slug, templates.data]);

  if (resolved?.saved) {
    if (appliedFiltersFor !== resolved.slug && filtersQuery(resolved.saved.filters) === query) {
      setAppliedFiltersFor(resolved.slug);
    }
  } else if (appliedFiltersFor !== null) {
    setAppliedFiltersFor(null);
  }
  const useStored = Boolean(resolved?.saved) && appliedFiltersFor !== resolved?.slug;
  const filters = useStored && resolved?.saved ? resolved.saved.filters : urlFilters;
  const { data: report, isFetching, isPending } = useReport(filters);

  const personNames = useMemo(
    () => new Map(members.map((member) => [member.userId, personLabel(member.user)])),
    [members],
  );
  const filterSummary = reportFilterSummary(filters, { ...names, person: personNames }, copy);

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

    if (resolved?.saved) {
      if (appliedFiltersFor !== resolved.slug) {
        const next = filtersQuery(resolved.saved.filters);
        if (next !== query) {
          router.replace(reportPath(resolved.slug, next), { scroll: false });
        }
      }
    }

    if (resolved) {
      writeLastSlug(organization.id, resolved.slug);
    }
  }, [
    appliedFiltersFor,
    canonical,
    listed,
    organization.id,
    query,
    reportsPending,
    resolved,
    router,
    slug,
    uuidReport,
  ]);

  const waitingForRedirect =
    !slug ||
    Boolean(canonical && canonical !== slug) ||
    Boolean(uuidReport && slugForSavedReport(uuidReport.name) !== slug);
  const waitingForLayout = Boolean(slug) && !resolved && (reportsPending || templates.isPending);
  const missing = Boolean(slug) && !waitingForRedirect && !waitingForLayout && !resolved;
  const showSkeleton = waitingForRedirect || waitingForLayout || (isPending && !report);

  return (
    <>
      <PageHeader
        actions={
          <div className='flex w-full flex-wrap items-center gap-2'>
            <ReportFilters filters={filters} />
            <div className='ml-auto flex flex-wrap items-center gap-2'>
              {isFetching ? <span className='text-xs text-muted-foreground'>Updating…</span> : null}
              <ReportMenu
                active={resolved?.slug ?? null}
                title={resolved?.title ?? "Report"}
                filters={filters}
                filterSummary={filterSummary}
                editHref={resolved?.editHref}
                cards={resolved?.cards ?? []}
                data={report}
                saved={resolved?.saved ?? null}
                templateKey={resolved?.templateKey ?? null}
              />
            </div>
          </div>
        }
      />
      {showSkeleton ? (
        <PageSkeleton />
      ) : missing ? (
        <EmptyState
          icon={FileQuestionIcon}
          title='That report is not available'
          description='It may have been renamed or deleted.'
        />
      ) : resolved ? (
        <ReportGrid cards={resolved.cards} data={report} filters={filters} />
      ) : null}
    </>
  );
}
