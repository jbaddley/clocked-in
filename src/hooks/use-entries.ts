"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useOrganization } from "@/hooks/use-workspace";
import { entriesQuery } from "@/lib/queries";
import type { DateRange } from "@/lib/types";

export function useEntries(userId: string, range: DateRange, unclassified = false) {
  const organization = useOrganization();
  const query = useInfiniteQuery(entriesQuery(organization.id, userId, range, unclassified));
  const entries = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  return { ...query, entries };
}
