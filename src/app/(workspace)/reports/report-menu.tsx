"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, MenuIcon } from "lucide-react";
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
import { csvUrl, summaryCsvUrl } from "@/lib/queries";
import type { ReportCard, ReportFilters } from "@/lib/report-layout";
import { viewCsvFromLayout } from "@/lib/report-view-csv";
import { reportPath, slugForSavedReport, standardReports } from "@/lib/report-slug";

export function listedSavedReports(reports: SavedReport[]) {
  return reports.filter((report) => !(report.isDashboard && !report.isDefault));
}

export function ReportMenu({
  active,
  filters,
  editHref,
  cards = [],
  data,
}: {
  active: string | null;
  filters: ReportFilters;
  editHref?: string | null;
  cards?: ReportCard[];
  data?: unknown;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const organization = useOrganization();
  const { isAdmin, permissions } = useWorkspace();
  const { reports } = useSavedReports();
  const custom = listedSavedReports(reports);
  const canDesign = isAdmin || permissions.includes("design_reports");
  const query = search.toString();

  function openReport(slug: string) {
    if (slug === active) return;
    router.replace(reportPath(slug, query), { scroll: false });
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
        {canDesign ? (
          <DropdownMenuItem render={<Link href="/reports/new" />}>Create custom report</DropdownMenuItem>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
