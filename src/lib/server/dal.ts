import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { listCollective } from "@/lib/api/features/collective";
import { listDepartments } from "@/lib/api/features/departments";
import { listOrganizationInvitations } from "@/lib/api/features/invitations";
import { listOrgMemberships } from "@/lib/api/features/memberships";
import { listOrganizations } from "@/lib/api/features/organizations";
import { listProjects } from "@/lib/api/features/projects";
import { report } from "@/lib/api/features/reports";
import { loadLookups } from "@/lib/api/features/lookups";
import { listTimeEntries } from "@/lib/api/features/time-entries";
import { organizationCookie } from "@/lib/server/session-cookies";
import { getAccess, requireAccess } from "@/lib/server/session";
import type { DateRange, GroupDepartments, Lookups, Viewer } from "@/lib/types";

export function searchParamsFor(values: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  return params;
}

export const getViewer = cache(async (): Promise<Viewer> => {
  const { caller } = await requireAccess();
  const profile = caller.profile;
  const name =
    profile?.displayName?.trim() || (profile ? `${profile.firstName} ${profile.lastName}`.trim() : "") || caller.username;
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return {
    id: caller.id,
    username: caller.username,
    email: caller.email,
    isSuperAdmin: caller.isSuperAdmin,
    name,
    initials,
    timezone: profile?.timezone?.trim() || "UTC",
  };
});

export const getOrganizations = cache(async () => {
  const access = await requireAccess();
  return (await listOrganizations(access, searchParamsFor({ limit: 100 }))).items;
});

export const getWorkspace = cache(async () => {
  const access = await requireAccess();
  const [viewer, organizations, store] = await Promise.all([getViewer(), getOrganizations(), cookies()]);
  const stored = store.get(organizationCookie)?.value;
  const organization = organizations.find((item) => item.id === stored) ?? organizations[0] ?? null;
  const role = organization ? await access.organizationRole(organization.id) : null;
  const isAdmin = organization ? viewer.isSuperAdmin || role === "ADMIN" : false;
  const canSelectRate = organization ? viewer.isSuperAdmin || role === "ADMIN" || role === "MEMBER" : false;
  const groupDepartments: GroupDepartments = !organization
    ? []
    : viewer.isSuperAdmin || role === "ADMIN"
      ? "all"
      : await access.adminDepartmentIds(organization.id);
  return { viewer, organizations, organization, isAdmin, canSelectRate, role, groupDepartments };
});

export const getCurrentOrganization = cache(async () => {
  const access = await getAccess();
  if (!access) {
    return null;
  }

  const [organizations, store] = await Promise.all([
    listOrganizations(access, searchParamsFor({ limit: 100 })),
    cookies(),
  ]);
  const stored = store.get(organizationCookie)?.value;
  return organizations.items.find((item) => item.id === stored) ?? organizations.items[0] ?? null;
});

export const getLookups = cache(async (organizationId: string): Promise<Lookups> =>
  loadLookups(await requireAccess(), organizationId),
);

export const getMembers = cache(async (organizationId: string) => {
  const access = await requireAccess();
  return (await listOrgMemberships(access, organizationId, searchParamsFor({ limit: 100 }))).items;
});

export const getInvitations = cache(async (organizationId: string) => {
  const access = await requireAccess();
  return (await listOrganizationInvitations(access, organizationId, searchParamsFor({ limit: 100 }))).items;
});

export async function getEntries(
  organizationId: string,
  userId: string,
  range: DateRange = {},
  offset = 0,
  limit = 50,
) {
  const access = await requireAccess();
  return listTimeEntries(access, userId, searchParamsFor({ organizationId, ...range, offset, limit }));
}

export async function getGroupSessions(organizationId: string, offset = 0, limit = 50) {
  const access = await requireAccess();
  return listCollective(access, searchParamsFor({ organizationId, offset, limit }));
}

export async function getOpenPunch() {
  const access = await requireAccess();
  const recent = await listTimeEntries(access, access.caller.id, searchParamsFor({ limit: 20 }));
  return recent.items.find((entry) => entry.mode === "Punch" && !entry.endedAt) ?? null;
}

export const getReport = cache(async (organizationId: string, from?: string, to?: string) => {
  const access = await requireAccess();
  return report(access, organizationId, searchParamsFor({ from, to }));
});
