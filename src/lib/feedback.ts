import type { FeedbackArea, FeedbackPriority, FeedbackStatus, FeedbackType } from "@/lib/api/json";

export const feedbackTypes: { value: FeedbackType; label: string; swatch?: string }[] = [
  { value: "Bug", label: "Bug", swatch: "bg-red-500" },
  { value: "Feature", label: "Feature request", swatch: "bg-emerald-500" },
];

export const feedbackPriorities: { value: FeedbackPriority; label: string; swatch?: string }[] = [
  { value: "Urgent", label: "Urgent", swatch: "bg-red-500" },
  { value: "High", label: "High", swatch: "bg-amber-500" },
  { value: "Medium", label: "Medium", swatch: "bg-sky-500" },
  { value: "Low", label: "Low", swatch: "bg-slate-400" },
];

export const feedbackAreas: { value: FeedbackArea; label: string; swatch?: string }[] = [
  { value: "Dashboard", label: "Dashboard", swatch: "bg-indigo-500" },
  { value: "LogTime", label: "Log time", swatch: "bg-violet-500" },
  { value: "Entries", label: "Entries", swatch: "bg-cyan-500" },
  { value: "Reports", label: "Reports", swatch: "bg-teal-500" },
  { value: "Settings", label: "Settings", swatch: "bg-amber-500" },
  { value: "Other", label: "Other", swatch: "bg-slate-400" },
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

export const feedbackStatuses: { value: FeedbackStatus; label: string; swatch?: string }[] = [
  { value: "Pending", label: "Pending", swatch: "bg-amber-500" },
  { value: "Acknowledged", label: "Acknowledged", swatch: "bg-sky-500" },
  { value: "Planned", label: "Planned", swatch: "bg-indigo-500" },
  { value: "InProgress", label: "In progress", swatch: "bg-blue-500" },
  { value: "Resolved", label: "Resolved", swatch: "bg-emerald-500" },
  { value: "Cancelled", label: "Cancelled", swatch: "bg-slate-400" },
  { value: "CouldNotReproduce", label: "Could not reproduce", swatch: "bg-zinc-400" },
  { value: "Archived", label: "Archived", swatch: "bg-neutral-400" },
];

export function feedbackOption<T extends string>(options: { value: T; label: string; swatch?: string }[], value: T) {
  return options.find((option) => option.value === value);
}

export function feedbackLabel<T extends string>(options: { value: T; label: string }[], value: T) {
  return options.find((option) => option.value === value)?.label ?? value;
}
