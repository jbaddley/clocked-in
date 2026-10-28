"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/use-workspace";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { savedReportsQuery } from "@/lib/queries";

const emptyReports: SavedReport[] = [];

export function useSavedReports() {
  const organization = useOrganization();
  const query = useQuery(savedReportsQuery(organization.id));
  return { ...query, reports: query.data ?? emptyReports };
}
