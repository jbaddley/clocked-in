import type { FeedbackArea, FeedbackPriority, FeedbackStatus, FeedbackType } from "@/lib/api/json";

export const feedbackTypes: { value: FeedbackType; label: string }[] = [
  { value: "Bug", label: "Bug" },
  { value: "Feature", label: "Feature request" },
];

export const feedbackPriorities: { value: FeedbackPriority; label: string }[] = [
  { value: "Urgent", label: "Urgent" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

export const feedbackAreas: { value: FeedbackArea; label: string }[] = [
  { value: "Dashboard", label: "Dashboard" },
  { value: "LogTime", label: "Log time" },
  { value: "Entries", label: "Entries" },
  { value: "Reports", label: "Reports" },
  { value: "Settings", label: "Settings" },
  { value: "Other", label: "Other" },
];

export function feedbackAreaForPath(pathname: string): FeedbackArea {
  const path = pathname.split("?")[0] || "/";
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "Dashboard";
  if (path === "/log" || path.startsWith("/log/")) return "LogTime";
  if (path === "/entries" || path.startsWith("/entries/")) return "Entries";
  if (path === "/reports" || path.startsWith("/reports/")) return "Reports";
  if (path === "/settings" || path.startsWith("/settings/")) return "Settings";
  return "Other";
}

export const feedbackStatuses: { value: FeedbackStatus; label: string }[] = [
  { value: "Pending", label: "Pending" },
  { value: "Acknowledged", label: "Acknowledged" },
  { value: "Planned", label: "Planned" },
  { value: "InProgress", label: "In progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "CouldNotReproduce", label: "Could not reproduce" },
  { value: "Archived", label: "Archived" },
];

export function feedbackLabel<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((option) => option.value === value)?.label ?? value;
}
