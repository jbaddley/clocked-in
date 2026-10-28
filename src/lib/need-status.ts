export const needStatuses = ["pending_approval", "published", "rejected", "draft"] as const;
export type NeedStatus = (typeof needStatuses)[number];

export function isNeedStatus(value: string): value is NeedStatus {
  return (needStatuses as readonly string[]).includes(value);
}

export function needStatusLabel(status: string) {
  if (status === "pending_approval") return "Pending review";
  if (status === "published") return "Published";
  if (status === "rejected") return "Rejected";
  if (status === "draft") return "Draft";
  return status;
}

export function needStatusVariant(status: string): "secondary" | "default" | "destructive" | "outline" {
  if (status === "pending_approval") return "secondary";
  if (status === "published") return "default";
  if (status === "rejected") return "destructive";
  return "outline";
}

export function needStatusRank(status: string) {
  if (status === "pending_approval") return 0;
  if (status === "published") return 1;
  if (status === "draft") return 2;
  if (status === "rejected") return 3;
  return 4;
}

export function isOwnedNeed(
  need: { createdByUserId: string; departmentId: string | null },
  viewerId: string,
  groupDepartments: "all" | string[],
) {
  if (groupDepartments === "all") return true;
  if (need.createdByUserId === viewerId) return true;
  return Boolean(need.departmentId && groupDepartments.includes(need.departmentId));
}
