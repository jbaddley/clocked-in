"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/use-workspace";
import { reportQuery } from "@/lib/queries";
import type { ReportFilters } from "@/lib/report-layout";

export function useReport(filter: ReportFilters) {
  const organization = useOrganization();
  return useQuery(reportQuery(organization.id, filter));
}
