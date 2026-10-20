import type { GroupDepartments } from "@/lib/types";

export function canLogGroupTime(groupDepartments: GroupDepartments) {
  return groupDepartments === "all" || groupDepartments.length > 0;
}
