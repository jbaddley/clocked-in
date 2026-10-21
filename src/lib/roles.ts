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
