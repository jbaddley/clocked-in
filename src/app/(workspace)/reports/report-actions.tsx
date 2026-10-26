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
import { csvUrl, summaryCsvUrl } from "@/lib/queries";
import type { DateRange } from "@/lib/types";

export function ReportActions({ range }: { range: DateRange }) {
  const organization = useOrganization();
  const { isAdmin } = useWorkspace();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="lg" />}>Actions</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isAdmin ? (
          <DropdownMenuItem render={<Link href="/reports/new" />}>Create custom report</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem render={<a href={csvUrl(organization.id, range)} download="volunteer-log.csv" />}>
          Download log
        </DropdownMenuItem>
        <DropdownMenuItem render={<a href={summaryCsvUrl(organization.id, range)} download="summary.csv" />}>
          Download report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
