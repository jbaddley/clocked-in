import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type {
  DateRange,
  GroupSession,
  Lookups,
  Feedback,
  Invitation,
  Membership,
  OrganizationApiKey,
  Paged,
  Report,
  Theme,
  TimeEntry,
} from "@/lib/types";

export const entriesPageSize = 50;

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }

  const text = params.toString();
  return text ? `?${text}` : "";
}

export const keys = {
  organization: (organizationId: string) => ["org", organizationId] as const,
  lookups: (organizationId: string) => ["org", organizationId, "lookups"] as const,
  members: (organizationId: string) => ["org", organizationId, "members"] as const,
  invitations: (organizationId: string) => ["org", organizationId, "invitations"] as const,
  apiKeys: (organizationId: string) => ["org", organizationId, "api-keys"] as const,
  entries: (organizationId: string, userId: string, range: DateRange) =>
    ["org", organizationId, "entries", userId, range.from ?? "", range.to ?? ""] as const,
  groupSessions: (organizationId: string) => ["org", organizationId, "group-sessions"] as const,
  report: (organizationId: string, range: DateRange) =>
    ["org", organizationId, "report", range.from ?? "", range.to ?? ""] as const,
  themes: (organizationId: string) => ["org", organizationId, "themes"] as const,
  openPunch: (userId: string) => ["user", userId, "open-punch"] as const,
  me: () => ["user", "me"] as const,
  feedback: (active?: boolean) => (active === undefined ? (["feedback"] as const) : (["feedback", active] as const)),
};

export const lookupStaleTime = 5 * 60 * 1000;
export const lookupGcTime = 24 * 60 * 60 * 1000;

export function lookupsQuery(organizationId: string, userId: string) {
  return queryOptions({
    queryKey: [...keys.lookups(organizationId), userId] as const,
    staleTime: lookupStaleTime,
    gcTime: lookupGcTime,
    queryFn: ({ signal }) => fetchJson<Lookups>(`/organizations/${organizationId}/lookups`, signal),
  });
}

export function membersQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.members(organizationId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<Membership>>(`/organizations/${organizationId}/memberships?limit=100`, signal)).items,
  });
}

export function apiKeysQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.apiKeys(organizationId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<OrganizationApiKey>>(`/organizations/${organizationId}/api-keys?limit=100`, signal)).items,
  });
}

export function invitationsQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.invitations(organizationId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<Invitation>>(`/organizations/${organizationId}/invitations?limit=100`, signal)).items,
  });
}

export function entriesQuery(organizationId: string, userId: string, range: DateRange) {
  return infiniteQueryOptions({
    queryKey: keys.entries(organizationId, userId, range),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchJson<Paged<TimeEntry>>(
        `/users/${userId}/time-entries${query({ organizationId, ...range, offset: pageParam, limit: entriesPageSize })}`,
        signal,
      ),
    getNextPageParam: (last) => (last.items.length < last.limit ? undefined : last.offset + last.limit),
  });
}

export function groupSessionsQuery(organizationId: string) {
  return infiniteQueryOptions({
    queryKey: keys.groupSessions(organizationId),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchJson<Paged<GroupSession>>(
        `/collective-time-entries${query({ organizationId, offset: pageParam, limit: entriesPageSize })}`,
        signal,
      ),
    getNextPageParam: (last) => (last.items.length < last.limit ? undefined : last.offset + last.limit),
  });
}

export function themesQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.themes(organizationId),
    queryFn: ({ signal }) =>
      fetchJson<Paged<Theme>>(`/organizations/${organizationId}/themes`, signal).then((page) => page.items),
  });
}

export function reportQuery(organizationId: string, range: DateRange) {
  return queryOptions({
    queryKey: keys.report(organizationId, range),
    queryFn: ({ signal }) =>
      fetchJson<Report>(`/organizations/${organizationId}/report${query({ ...range })}`, signal),
  });
}

export function openPunchQuery(userId: string) {
  return queryOptions({
    queryKey: keys.openPunch(userId),
    queryFn: async ({ signal }) => {
      const recent = await fetchJson<Paged<TimeEntry>>(`/users/${userId}/time-entries?limit=20`, signal);
      return recent.items.find((entry) => entry.mode === "Punch" && !entry.endedAt) ?? null;
    },
  });
}

export type MeUser = {
  username: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    timezone: string;
    phone: string | null;
    zipCode: string | null;
    notes: string | null;
  } | null;
};

export function meQuery() {
  return queryOptions({
    queryKey: keys.me(),
    queryFn: ({ signal }) => fetchJson<MeUser>("/users/me", signal),
  });
}

export function feedbackQuery(active: boolean) {
  return queryOptions({
    queryKey: keys.feedback(active),
    queryFn: ({ signal }) =>
      fetchJson<Paged<Feedback>>(`/feedback${query({ active: String(active), limit: 100 })}`, signal),
  });
}

export function csvUrl(organizationId: string, range: DateRange) {
  return `/organizations/${organizationId}/time-entries.csv${query({ ...range })}`;
}

export function summaryCsvUrl(organizationId: string, range: DateRange) {
  return `/organizations/${organizationId}/summary.csv${query({ ...range })}`;
}
