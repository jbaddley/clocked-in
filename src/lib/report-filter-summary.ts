import { formatDate } from "@/lib/format";
import type { ReportFilters } from "@/lib/report-layout";

export type FilterNames = {
  department: Map<string, string>;
  project: Map<string, string>;
  category: Map<string, string>;
  person: Map<string, string>;
};

export function personLabel(person: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string;
}) {
  const display = person.displayName?.trim();
  if (display) return display;
  const full = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return full || person.username;
}

function datePart(filters: ReportFilters) {
  if (filters.from && filters.to && filters.from === filters.to) return formatDate(filters.from);
  if (filters.from && filters.to) return `${formatDate(filters.from)} – ${formatDate(filters.to)}`;
  if (filters.from) return `Since ${formatDate(filters.from)}`;
  if (filters.to) return `Through ${formatDate(filters.to)}`;
  return "All time";
}

export function reportFilterSummary(
  filters: ReportFilters,
  names: FilterNames,
  copy: { department: string; project: string; taskCategory: string; departments: string },
) {
  const parts = [datePart(filters)];
  if (filters.departmentId) parts.push(names.department.get(filters.departmentId) ?? copy.department);
  if (filters.taskCategoryId) parts.push(names.category.get(filters.taskCategoryId) ?? copy.taskCategory);
  if (filters.projectId) parts.push(names.project.get(filters.projectId) ?? copy.project);
  if (filters.userId) parts.push(names.person.get(filters.userId) ?? "Person");
  if (parts.length === 1 && parts[0] === "All time") {
    parts.push(`All ${copy.departments.toLowerCase()}`);
  }
  return parts.join(" · ");
}
