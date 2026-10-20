import "server-only";
import type { QueryClient } from "@tanstack/react-query";
import {
  entriesPageSize,
  entriesQuery,
  groupSessionsQuery,
  invitationsQuery,
  lookupsQuery,
  membersQuery,
  openPunchQuery,
  reportQuery,
} from "@/lib/queries";
import { getEntries, getGroupSessions, getInvitations, getLookups, getMembers, getOpenPunch, getReport } from "@/lib/server/dal";
import type { DateRange } from "@/lib/types";

export function prefetchLookups(client: QueryClient, organizationId: string, userId: string) {
  return client.prefetchQuery({
    ...lookupsQuery(organizationId, userId),
    queryFn: () => getLookups(organizationId),
  });
}

export function prefetchMembers(client: QueryClient, organizationId: string) {
  return client.prefetchQuery({ ...membersQuery(organizationId), queryFn: () => getMembers(organizationId) });
}

export function prefetchInvitations(client: QueryClient, organizationId: string) {
  return client.prefetchQuery({ ...invitationsQuery(organizationId), queryFn: () => getInvitations(organizationId) });
}

export function prefetchEntries(client: QueryClient, organizationId: string, userId: string, range: DateRange) {
  return client.prefetchInfiniteQuery({
    ...entriesQuery(organizationId, userId, range),
    queryFn: ({ pageParam }) => getEntries(organizationId, userId, range, pageParam, entriesPageSize),
  });
}

export function prefetchGroupSessions(client: QueryClient, organizationId: string) {
  return client.prefetchInfiniteQuery({
    ...groupSessionsQuery(organizationId),
    queryFn: ({ pageParam }) => getGroupSessions(organizationId, pageParam, entriesPageSize),
  });
}

export function prefetchReport(client: QueryClient, organizationId: string, range: DateRange) {
  return client.prefetchQuery({
    ...reportQuery(organizationId, range),
    queryFn: () => getReport(organizationId, range.from, range.to),
  });
}

export function prefetchOpenPunch(client: QueryClient, userId: string) {
  return client.prefetchQuery({ ...openPunchQuery(userId), queryFn: () => getOpenPunch() });
}
