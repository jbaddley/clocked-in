"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { csvUrl, summaryCsvUrl, viewCsvUrl } from "@/lib/queries";
import type { DateRange } from "@/lib/types";

export function ReportActions({ range, reportId }: { range: DateRange; reportId?: string }) {
  const organization = useOrganization();
  const { isAdmin, permissions } = useWorkspace();
  const canDesign = isAdmin || permissions.includes("design_reports");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="lg" />}>Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canDesign && reportId ? (
          <DropdownMenuItem render={<Link href={`/reports/${reportId}/design`} />}>Edit Report</DropdownMenuItem>
        ) : null}
        {canDesign ? (
          <DropdownMenuItem render={<Link href="/reports/new" />}>Create custom report</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem render={<a href={viewCsvUrl(organization.id, range)} download="report-view.csv" />}>
          Download this view
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={csvUrl(organization.id, range)} download="volunteer-log.csv" />}>
          Download Volunteer Log (grant format)
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={summaryCsvUrl(organization.id, range)} download="summary.csv" />}>
          Download Summary (grant format)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
