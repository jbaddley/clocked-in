"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useOrganization } from "@/hooks/use-workspace";
import { groupSessionsQuery } from "@/lib/queries";

export function useGroupSessions() {
  const organization = useOrganization();
  const query = useInfiniteQuery(groupSessionsQuery(organization.id));
  const sessions = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  return { ...query, sessions };
}
