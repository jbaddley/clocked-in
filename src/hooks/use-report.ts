"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/use-workspace";
import { reportQuery } from "@/lib/queries";
import type { DateRange } from "@/lib/types";

export function useReport(range: DateRange) {
  const organization = useOrganization();
  return useQuery(reportQuery(organization.id, range));
}
