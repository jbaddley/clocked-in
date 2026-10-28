import { pathParts } from "@/lib/report-path";
import type { ReportFilters } from "@/lib/report-layout";

export type EntriesHrefFilter = ReportFilters & {
  everyone?: boolean;
  unclassified?: boolean;
};

function monthRange(id: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(id);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${String(last).padStart(2, "0")}`,
  };
}

export function entriesSearch(filter: EntriesHrefFilter) {
  const params = new URLSearchParams();
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.userId) params.set("person", filter.userId);
  if (filter.projectId) params.set("projectId", filter.projectId);
  if (filter.taskCategoryId) params.set("taskCategoryId", filter.taskCategoryId);
  if (filter.departmentId) params.set("departmentId", filter.departmentId);
  if (filter.unclassified) params.set("unclassified", "1");
  if (filter.everyone) params.set("everyone", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function entriesHref(filter: EntriesHrefFilter = {}) {
  return `/entries${entriesSearch(filter)}`;
}

export function entriesHrefFromAccessor(
  accessor: string,
  options: { filters?: ReportFilters; rowId?: string } = {},
) {
  const filter: EntriesHrefFilter = { ...(options.filters ?? {}) };
  const parts = pathParts(accessor) ?? [];
  const side = parts[0];
  const dimension = parts[1];

  if (side === "entries") {
    if (dimension === "organization") filter.everyone = true;
    return entriesHref(filter);
  }

  if (side === "user" || side === "staff" || side === "collective") {
    filter.everyone = true;
  }

  const rowId = options.rowId;
  if (rowId && rowId !== "other") {
    if (rowId === "unclassified") {
      filter.unclassified = true;
    } else if (dimension === "byCategory") {
      filter.taskCategoryId = rowId;
    } else if (dimension === "byProject") {
      filter.projectId = rowId;
    } else if (dimension === "byDepartment" && rowId !== "organization") {
      filter.departmentId = rowId;
    } else if (dimension === "byPerson" || dimension === "byVolunteer") {
      filter.userId = rowId;
      filter.everyone = false;
    } else if (dimension === "byMonth") {
      const month = monthRange(rowId);
      if (month) {
        filter.from = month.from;
        filter.to = month.to;
      }
    }
  }

  return entriesHref(filter);
}
