import type { GroupDepartments } from "@/lib/types";

export function canLogGroupTime(groupDepartments: GroupDepartments) {
  return groupDepartments === "all" || groupDepartments.length > 0;
}

export function isCoordinator(groupDepartments: GroupDepartments) {
  return groupDepartments !== "all" && groupDepartments.length > 0;
}

export function canLogMemberTime(isAdmin: boolean, groupDepartments: GroupDepartments) {
  return isAdmin || isCoordinator(groupDepartments);
}

export function canLogConnectionTime(input: {
  role: string | null;
  isAdmin: boolean;
  allowVolunteersToAddVolunteers: boolean;
  connectionCount: number;
}) {
  if (input.role === "VOLUNTEER" && (input.allowVolunteersToAddVolunteers || input.connectionCount > 0)) {
    return true;
  }

  return input.isAdmin && input.connectionCount > 0;
}

export function canSeeReports(input: { role: string | null; isAdmin: boolean; isCoordinator: boolean }) {
  return input.isAdmin || input.isCoordinator || input.role === "MEMBER";
}
