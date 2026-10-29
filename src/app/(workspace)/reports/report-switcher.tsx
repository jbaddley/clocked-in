"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
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
import type { SavedReport } from "@/lib/api/features/saved-reports";
import {
  isReportViewerPath,
  reportPath,
  slugForSavedReport,
  standardReports,
  viewerSlug,
} from "@/lib/report-slug";

export function listedSavedReports(reports: SavedReport[]) {
  return reports.filter((report) => !(report.isDashboard && !report.isDefault));
}

export function ReportSwitcher() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const search = useSearchParams();
  const { reports } = useSavedReports();
  const custom = listedSavedReports(reports);
  const slug = viewerSlug(pathname);
  const spec = slug ? standardReports.find((item) => item.slug === slug) : null;
  const saved = slug
    ? custom.find((report) => slugForSavedReport(report.name) === slug || report.id === slug)
    : null;
  const active = spec?.slug ?? (saved ? slugForSavedReport(saved.name) : slug);
  const label = spec?.label ?? saved?.name ?? "Report";

  if (!isReportViewerPath(pathname)) return null;

  function openReport(next: string) {
    if (next === active) return;
    const customReport = custom.find((report) => slugForSavedReport(report.name) === next);
    router.replace(customReport ? reportPath(next) : reportPath(next, search.toString()), { scroll: false });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            aria-label="Choose report"
            className="-ml-2 h-auto max-w-full min-w-0 gap-1.5 px-2 py-1 font-heading text-2xl font-semibold tracking-tight"
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon data-icon="inline-end" className="size-5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
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
                const reportSlug = slugForSavedReport(report.name);
                return (
                  <DropdownMenuItem key={report.id} onClick={() => openReport(reportSlug)}>
                    <span className="truncate">{report.isDefault ? `${report.name} (default)` : report.name}</span>
                    {active === reportSlug ? <CheckIcon className="ml-auto" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
