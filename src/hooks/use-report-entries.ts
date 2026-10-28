"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useEntries } from "@/hooks/use-entries";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { organizationEntriesQuery } from "@/lib/queries";
import type { TimeEntry } from "@/lib/types";

export function useReportEntries() {
  const organization = useOrganization();
  const { viewer } = useWorkspace();
  const mine = useEntries(viewer.id, {});
  const organizationEntries = useQuery(organizationEntriesQuery(organization.id));
  const entries = useMemo(
    () => ({
      mine: mine.entries,
      organization: organizationEntries.data?.items ?? [],
    }),
    [mine.entries, organizationEntries.data],
  );
  return {
    entries,
    isPending: mine.isPending || organizationEntries.isPending,
  };
}

export function withEntries<T extends object>(data: T | undefined, entries: { mine: TimeEntry[]; organization: TimeEntry[] }) {
  if (!data) return undefined;
  return { ...data, entries };
}
