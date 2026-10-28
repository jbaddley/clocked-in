"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MenuIcon } from "lucide-react";
import { toast } from "sonner";
import { updateReportAction } from "@/app/actions/reports";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { downloadTextFile } from "@/lib/download";
import { csvUrl, keys, summaryCsvUrl } from "@/lib/queries";
import { filtersEqual, filtersQuery, type ReportCard, type ReportFilters } from "@/lib/report-layout";
import { downloadReportPdf } from "@/lib/report-pdf/download";
import { viewCsvFromLayout } from "@/lib/report-view-csv";
import { newReportPath } from "@/lib/report-slug";

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
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const { isAdmin, permissions } = useWorkspace();
  const canDesign = isAdmin || permissions.includes("design_reports");
  const canExport = isAdmin || permissions.includes("export_reports");
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const dirtyFilters = Boolean(saved) && !filtersEqual(filters, saved?.filters ?? {});

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
        {canDesign && editHref ? <DropdownMenuItem render={<Link href={editHref} />}>Edit</DropdownMenuItem> : null}
        {canDesign ? (
          <DropdownMenuItem render={<Link href={newReportPath(filtersQuery(filters), templateKey)} />}>
            Create
          </DropdownMenuItem>
        ) : null}
        {canDesign && dirtyFilters ? (
          <DropdownMenuItem disabled={saving} onClick={() => void saveFilters()}>
            {saving ? "Saving filters…" : "Save filters"}
          </DropdownMenuItem>
        ) : null}
        {canDesign ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onClick={() => downloadTextFile("report-view.csv", viewCsvFromLayout(cards, data ?? {}))}>
          Download CSV
        </DropdownMenuItem>
        {canExport ? (
          <DropdownMenuItem disabled={downloadingPdf} onClick={() => void downloadPdf()}>
            {downloadingPdf ? "Preparing PDF…" : "Download PDF"}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<a href={csvUrl(organization.id, filters)} download="volunteer-log.csv" />}>
          Download Full Volunteer Log
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={summaryCsvUrl(organization.id, filters)} download="summary.csv" />}>
          Download Full Summary
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
