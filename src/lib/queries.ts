import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetch-json";
import type { MemberConnectionRecord } from "@/lib/member-connection";
import type { ReportFilters } from "@/lib/report-layout";
import type { ReportTemplate } from "@/lib/api/features/report-templates";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import type {
  DateRange,
  GroupSession,
  Lookups,
  Feedback,
  VolunteerNeed,
  VolunteerSignup,
  Invitation,
  Membership,
  OrganizationApiKey,
  Paged,
  Report,
  Theme,
  TimeEntry,
} from "@/lib/types";

export const entriesPageSize = 50;

export type EntriesListFilter = DateRange & {
  projectId?: string;
  taskCategoryId?: string;
  departmentId?: string;
  unclassified?: boolean;
  everyone?: boolean;
};

function query(values: Record<string, string | number | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    const text = Array.isArray(value) ? value.join(",") : value;
    if (text !== undefined && text !== "") params.set(key, String(text));
  }

  const text = params.toString();
  return text ? `?${text}` : "";
}

export const keys = {
  organization: (organizationId: string) => ["org", organizationId] as const,
  lookups: (organizationId: string) => ["org", organizationId, "lookups"] as const,
  members: (organizationId: string) => ["org", organizationId, "members"] as const,
  connections: (organizationId: string) => ["org", organizationId, "connections"] as const,
  invitations: (organizationId: string) => ["org", organizationId, "invitations"] as const,
  departmentInvitations: (departmentId: string) => ["department", departmentId, "invitations"] as const,
  apiKeys: (organizationId: string) => ["org", organizationId, "api-keys"] as const,
  entries: (organizationId: string, userId: string, filter: EntriesListFilter = {}) =>
    [
      "org",
      organizationId,
      "entries",
      userId,
      filter.from ?? "",
      filter.to ?? "",
      filter.projectId ?? "",
      filter.taskCategoryId ?? "",
      filter.departmentId ?? "",
      filter.unclassified ?? false,
      filter.everyone ?? false,
    ] as const,
  organizationEntries: (organizationId: string) => ["org", organizationId, "recent-entries"] as const,
  groupSessions: (organizationId: string) => ["org", organizationId, "group-sessions"] as const,
  report: (organizationId: string, filter: ReportFilters) => ["org", organizationId, "report", filter] as const,
  savedReports: (organizationId: string) => ["org", organizationId, "saved-reports"] as const,
  savedReport: (organizationId: string, reportId: string) => ["org", organizationId, "saved-reports", reportId] as const,
  reportTemplates: (organizationId: string) => ["org", organizationId, "report-templates"] as const,
  reportTemplate: (organizationId: string, templateId: string) =>
    ["org", organizationId, "report-templates", templateId] as const,
  savedReportData: (organizationId: string, reportId: string, filter: ReportFilters) =>
    ["org", organizationId, "saved-report-data", reportId, filter] as const,
  themes: (organizationId: string) => ["org", organizationId, "themes"] as const,
  openPunch: (userId: string) => ["user", userId, "open-punch"] as const,
  me: () => ["user", "me"] as const,
  feedback: (active?: boolean) => (active === undefined ? (["feedback"] as const) : (["feedback", active] as const)),
  feedbackItem: (id: string) => ["feedback", "item", id] as const,
  needs: (organizationId: string) => ["org", organizationId, "needs"] as const,
  need: (needId: string) => ["need", needId] as const,
  signups: (needId: string) => ["need", needId, "signups"] as const,
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

export function connectionsQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.connections(organizationId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<MemberConnectionRecord>>(`/organizations/${organizationId}/connections?limit=100`, signal))
        .items,
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

export function departmentInvitationsQuery(departmentId: string) {
  return queryOptions({
    queryKey: keys.departmentInvitations(departmentId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<Invitation>>(`/departments/${departmentId}/invitations?limit=100`, signal)).items,
  });
}

export function organizationEntriesQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.organizationEntries(organizationId),
    queryFn: ({ signal }) =>
      fetchJson<Paged<TimeEntry>>(`/organizations/${organizationId}/time-entries${query({ limit: 20 })}`, signal),
  });
}

export function entriesQuery(organizationId: string, userId: string, filter: EntriesListFilter = {}) {
  const placement = {
    from: filter.from,
    to: filter.to,
    projectId: filter.projectId,
    taskCategoryId: filter.taskCategoryId,
    departmentId: filter.departmentId,
    unclassified: filter.unclassified ? "1" : undefined,
  };
  return infiniteQueryOptions({
    queryKey: keys.entries(organizationId, userId, filter),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchJson<Paged<TimeEntry>>(
        filter.everyone
          ? `/organizations/${organizationId}/time-entries${query({ ...placement, userId: userId || undefined, offset: pageParam, limit: entriesPageSize })}`
          : `/users/${userId}/time-entries${query({ organizationId, ...placement, offset: pageParam, limit: entriesPageSize })}`,
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

export function reportQuery(organizationId: string, filter: ReportFilters) {
  return queryOptions({
    queryKey: keys.report(organizationId, filter),
    queryFn: ({ signal }) => fetchJson<Report>(`/organizations/${organizationId}/report${query({ ...filter })}`, signal),
  });
}

export function savedReportsQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.savedReports(organizationId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<SavedReport>>(`/organizations/${organizationId}/reports?limit=100`, signal)).items,
  });
}

export function reportTemplatesQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.reportTemplates(organizationId),
    queryFn: async ({ signal }) =>
      (await fetchJson<Paged<ReportTemplate>>(`/organizations/${organizationId}/report-templates?limit=100`, signal)).items,
  });
}

export function reportTemplateQuery(organizationId: string, templateId: string) {
  return queryOptions({
    queryKey: keys.reportTemplate(organizationId, templateId),
    queryFn: ({ signal }) =>
      fetchJson<ReportTemplate>(`/organizations/${organizationId}/report-templates/${templateId}`, signal),
  });
}

export function savedReportQuery(organizationId: string, reportId: string) {
  return queryOptions({
    queryKey: keys.savedReport(organizationId, reportId),
    queryFn: ({ signal }) => fetchJson<SavedReport>(`/organizations/${organizationId}/reports/${reportId}`, signal),
  });
}

export function savedReportDataQuery(organizationId: string, reportId: string, filter: Pick<ReportFilters, "from" | "to">) {
  return queryOptions({
    queryKey: keys.savedReportData(organizationId, reportId, filter),
    queryFn: ({ signal }) =>
      fetchJson<Report>(
        `/organizations/${organizationId}/reports/${reportId}/data${query({ ...filter, clearDates: "true" })}`,
        signal,
      ),
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
  id: string;
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
    avatarUrl: string | null;
    description: string | null;
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

export function feedbackItemQuery(id: string) {
  return queryOptions({
    queryKey: keys.feedbackItem(id),
    queryFn: ({ signal }) => fetchJson<Feedback>(`/feedback/${id}`, signal),
  });
}

export function needsQuery(organizationId: string) {
  return queryOptions({
    queryKey: keys.needs(organizationId),
    queryFn: ({ signal }) => fetchJson<Paged<VolunteerNeed>>(`/organizations/${organizationId}/volunteer-needs?limit=100`, signal),
  });
}

export function needQuery(needId: string) {
  return queryOptions({
    queryKey: keys.need(needId),
    queryFn: ({ signal }) => fetchJson<VolunteerNeed>(`/volunteer-needs/${needId}`, signal),
  });
}

export function signupsQuery(needId: string) {
  return queryOptions({
    queryKey: keys.signups(needId),
    queryFn: ({ signal }) => fetchJson<Paged<VolunteerSignup>>(`/volunteer-needs/${needId}/signups`, signal),
  });
}

export function csvUrl(organizationId: string, filter: ReportFilters) {
  return `/organizations/${organizationId}/time-entries.csv${query({ ...filter })}`;
}

export function summaryCsvUrl(organizationId: string, filter: ReportFilters) {
  return `/organizations/${organizationId}/summary.csv${query({ ...filter })}`;
}

export function viewCsvUrl(organizationId: string, filter: ReportFilters) {
  return `/organizations/${organizationId}/view.csv${query({ ...filter })}`;
}
