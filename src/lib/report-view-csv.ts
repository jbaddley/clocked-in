import { csvDocument, csvRow } from "@/lib/csv";
import { getPath } from "@/lib/report-path";
import {
  listColumnLabel,
  presentListRows,
  type ListColumn,
  type ReportCard,
} from "@/lib/report-layout";
import type { ReportGroup, TimeEntry } from "@/lib/types";

function hoursCell(hours: number) {
  return hours.toFixed(2);
}

function moneyCell(value: number) {
  return value.toFixed(2);
}

function asGroups(value: unknown) {
  return Array.isArray(value) ? (value as ReportGroup[]) : [];
}

function listHeaders(columns: ListColumn[]) {
  return columns.map((column) => listColumnLabel(column));
}

function listCells(row: ReportGroup, columns: ListColumn[], totalHours: number) {
  return columns.map((column) => {
    if (column === "name") return row.label;
    if (column === "type") return row.projectType ?? "";
    if (column === "hours") return hoursCell(row.hours);
    if (column === "share") {
      const percent = totalHours > 0 ? Math.round((row.hours / totalHours) * 100) : 0;
      return `${percent}%`;
    }
    if (column === "people") return String(row.volunteers);
    return moneyCell(row.inKind);
  });
}

function entryRow(entry: TimeEntry) {
  const hours = (entry.durationMinutes ?? 0) / 60;
  return csvRow([entry.occurredOn, hoursCell(hours), entry.description ?? ""]);
}

export function viewCsvFromLayout(cards: ReportCard[], data: unknown) {
  const lines: string[] = [];
  for (const card of cards) {
    if (lines.length > 0) lines.push("");
    lines.push(csvRow([card.title]));
    const resolved = getPath(data, card.accessor);

    if (card.kind === "value") {
      const value = typeof resolved === "number" ? resolved : resolved == null ? "" : String(resolved);
      lines.push(csvRow(["Value", typeof value === "number" ? hoursCell(value) : value]));
      continue;
    }

    if (card.kind === "entries") {
      const entries = Array.isArray(resolved) ? (resolved as TimeEntry[]) : [];
      lines.push(csvRow(["Date", "Hours", "Notes"]));
      for (const entry of entries.slice(0, card.limit)) {
        lines.push(entryRow(entry));
      }
      continue;
    }

    const groups = asGroups(resolved);
    if (card.kind === "list") {
      const presented = presentListRows(groups, card);
      const total = presented.reduce((sum, row) => sum + row.hours, 0);
      const columns = card.visibleColumns.length > 0 ? card.visibleColumns : (["name", "hours", "inKind"] as ListColumn[]);
      lines.push(csvRow(listHeaders(columns)));
      for (const row of presented) {
        lines.push(csvRow(listCells(row, columns, total)));
      }
      continue;
    }

    const valueKey = card.valueKey;
    lines.push(csvRow(["Label", valueKey === "inKind" ? "In-kind" : "Hours"]));
    for (const row of groups) {
      lines.push(csvRow([row.label, valueKey === "inKind" ? moneyCell(row.inKind) : hoursCell(row.hours)]));
    }
  }

  return csvDocument(lines);
}
