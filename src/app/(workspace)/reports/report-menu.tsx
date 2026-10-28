"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, MenuIcon } from "lucide-react";
import { toast } from "sonner";
import { updateReportAction } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSavedReports } from "@/hooks/use-saved-reports";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { downloadTextFile } from "@/lib/download";
import { csvUrl, keys, summaryCsvUrl } from "@/lib/queries";
import { filtersEqual, filtersQuery, type ReportCard, type ReportFilters } from "@/lib/report-layout";
import { downloadReportPdf } from "@/lib/report-pdf/download";
import { viewCsvFromLayout } from "@/lib/report-view-csv";
import { newReportPath, reportPath, slugForSavedReport, standardReports } from "@/lib/report-slug";

export function listedSavedReports(reports: SavedReport[]) {
  return reports.filter((report) => !(report.isDashboard && !report.isDefault));
}

export function ReportMenu({
  active,
  title,
  filters,
  filterSummary,
  editHref,
  cards = [],
  data,
  saved,
  templateKey,
}: {
  active: string | null;
  title: string;
  filters: ReportFilters;
  filterSummary: string;
  editHref?: string | null;
  cards?: ReportCard[];
  data?: unknown;
  saved?: SavedReport | null;
  templateKey?: string | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const { isAdmin, permissions } = useWorkspace();
  const { reports } = useSavedReports();
  const custom = listedSavedReports(reports);
  const canDesign = isAdmin || permissions.includes("design_reports");
  const canExport = isAdmin || permissions.includes("export_reports");
  const query = search.toString();
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const dirtyFilters = Boolean(saved) && !filtersEqual(filters, saved?.filters ?? {});

  function openReport(slug: string) {
    if (slug === active) return;
    const customReport = custom.find((report) => slugForSavedReport(report.name) === slug);
    router.replace(customReport ? reportPath(slug) : reportPath(slug, query), { scroll: false });
  }

  async function saveFilters() {
    if (!saved) return;
    setSaving(true);
    const result = await updateReportAction(organization.id, saved.id, { filters });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: keys.savedReports(organization.id) });
    await queryClient.invalidateQueries({ queryKey: keys.savedReport(organization.id, saved.id) });
    toast.success("Filters saved.");
  }

  async function downloadPdf() {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    const toastId = toast.loading("Preparing PDF…");
    try {
      await downloadReportPdf({
        title,
        slug: active ?? "report",
        organization,
        filters,
        filterSummary,
        cards,
        data,
      });
      toast.success("PDF downloaded.", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The PDF could not be created.", { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="icon-lg" aria-label="Reports menu" />}>
        <MenuIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Standard</DropdownMenuLabel>
          {standardReports.map((item) => (
            <DropdownMenuItem key={item.slug} onClick={() => openReport(item.slug)}>
              <span className="truncate">{item.label}</span>
              {active === item.slug ? <CheckIcon className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {custom.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Custom</DropdownMenuLabel>
              {custom.map((report) => {
                const slug = slugForSavedReport(report.name);
                return (
                  <DropdownMenuItem key={report.id} onClick={() => openReport(slug)}>
                    <span className="truncate">{report.isDefault ? `${report.name} (default)` : report.name}</span>
                    {active === slug ? <CheckIcon className="ml-auto" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        {canDesign && editHref ? (
          <DropdownMenuItem render={<Link href={editHref} />}>Edit report</DropdownMenuItem>
        ) : null}
        {canDesign && dirtyFilters ? (
          <DropdownMenuItem disabled={saving} onClick={() => void saveFilters()}>
            {saving ? "Saving filters…" : "Save filters"}
          </DropdownMenuItem>
        ) : null}
        {canDesign ? (
          <DropdownMenuItem render={<Link href={newReportPath(filtersQuery(filters), templateKey)} />}>
            Create custom report
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onClick={() => downloadTextFile("report-view.csv", viewCsvFromLayout(cards, data ?? {}))}
        >
          Download this view
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={csvUrl(organization.id, filters)} download="volunteer-log.csv" />}>
          Download Volunteer Log (grant format)
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={summaryCsvUrl(organization.id, filters)} download="summary.csv" />}>
          Download Summary (grant format)
        </DropdownMenuItem>
        {canExport ? (
          <DropdownMenuItem disabled={downloadingPdf} onClick={() => void downloadPdf()}>
            {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
