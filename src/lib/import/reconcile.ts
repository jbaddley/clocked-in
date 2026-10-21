import type { ImportField } from "@/lib/import/fields";

export type ColumnAssignment = {
  column: number;
  field: string | null;
  confident: boolean;
};

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function reconcile(fields: ImportField[], headers: string[] | null, sampleRows: string[][]): ColumnAssignment[] {
  const width = Math.max(headers?.length ?? 0, ...sampleRows.map((row) => row.length), 0);
  if (width === 0) {
    return [];
  }

  const samples = Array.from({ length: width }, (_, column) => sampleRows.map((row) => row[column] ?? ""));
  const candidates: { column: number; field: string; rank: number }[] = [];
  for (let column = 0; column < width; column += 1) {
    const header = headers ? normalizeHeader(headers[column] ?? "") : "";
    if (header) {
      const aliasHits = fields.filter((field) => field.aliases.some((alias) => normalizeHeader(alias) === header));
      if (aliasHits.length === 1) {
        candidates.push({ column, field: aliasHits[0].key, rank: 2 });
        continue;
      }
    }

    const sampleHits = fields.filter((field) => field.matchesSample?.(samples[column]) ?? false);
    if (sampleHits.length === 1) {
      candidates.push({ column, field: sampleHits[0].key, rank: 1 });
    }
  }

  candidates.sort((left, right) => right.rank - left.rank || left.column - right.column);
  const usedFields = new Set<string>();
  const assigned = new Map<number, string>();
  for (const candidate of candidates) {
    if (usedFields.has(candidate.field) || assigned.has(candidate.column)) {
      continue;
    }

    usedFields.add(candidate.field);
    assigned.set(candidate.column, candidate.field);
  }

  return Array.from({ length: width }, (_, column) => ({
    column,
    field: assigned.get(column) ?? null,
    confident: assigned.has(column),
  }));
}

export function fieldChoices(fields: ImportField[], assignments: { column: number; field: string | null }[], column: number) {
  const taken = new Set(assignments.filter((item) => item.column !== column && item.field).map((item) => item.field));
  return fields.filter((field) => !taken.has(field.key));
}

export function missingRequired(fields: ImportField[], assignments: { field: string | null }[]) {
  const chosen = new Set(assignments.map((item) => item.field).filter((field) => field !== null));
  return fields.filter((field) => field.required && !chosen.has(field.key));
}

export function applyMapping(rows: string[][], assignments: { column: number; field: string | null }[]) {
  return rows.map((row) => {
    const mapped: Record<string, string> = {};
    for (const assignment of assignments) {
      if (!assignment.field) {
        continue;
      }

      mapped[assignment.field] = (row[assignment.column] ?? "").trim();
    }

    return mapped;
  });
}
