import { chartTypes, paletteTypes, type ChartType, type PaletteType } from "@/lib/chart-palette";
import { pathParts } from "@/lib/report-path";

export const reportColumnCount = 12;
export const reportMaxRow = 48;
export const reportMaxCards = 40;

export const valueColors = ["primary", "highlight", "accent", "success"] as const;
export type ValueColor = (typeof valueColors)[number];

export const valueFormats = ["number", "hours", "currency"] as const;
export type ValueFormat = (typeof valueFormats)[number];

export const chartFormats = ["hours", "currency"] as const;
export type ChartFormat = (typeof chartFormats)[number];

export const valueIcons = ["clock", "hand-coins", "users", "list-checks"] as const;
export type ValueIcon = (typeof valueIcons)[number];

export const chartValueKeys = ["hours", "inKind"] as const;
export type ChartValueKey = (typeof chartValueKeys)[number];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Box = { column: number; row: number; columns: number; rows: number };

export type ReportCardBase = Box & {
  id: string;
  title: string;
  description: string;
  accessor: string;
};

export type ValueReportCard = ReportCardBase & {
  kind: "value";
  color: ValueColor;
  format: ValueFormat;
  icon: ValueIcon | null;
};

export type ChartReportCard = ReportCardBase & {
  kind: "chart";
  chartType: ChartType;
  palette: PaletteType;
  valueKey: ChartValueKey;
  format: ChartFormat;
};

export type ReportCard = ValueReportCard | ChartReportCard;

export type ReportLayout = {
  version: 1;
  cards: ReportCard[];
};

export type ReportFilters = {
  departmentId?: string;
  taskCategoryId?: string;
  projectId?: string;
  userId?: string;
  from?: string;
  to?: string;
};

function fail(message: string): never {
  throw new Error(message);
}

function asObject(value: unknown, label: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }

  return { ...(value as Record<string, unknown>) };
}

function take(source: Record<string, unknown>, key: string) {
  const has = Object.prototype.hasOwnProperty.call(source, key);
  const value = source[key];
  delete source[key];
  return { has, value };
}

function leftover(source: Record<string, unknown>, label: string) {
  if (Object.keys(source).length > 0) {
    fail(`${label} contains an unknown field.`);
  }
}

function text(value: unknown, key: string, max: number, required: boolean) {
  if (typeof value !== "string") {
    fail(required ? `${key} is required.` : `${key} must be a string.`);
  }

  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    fail(`${key} is required.`);
  }

  if (trimmed.length > max) {
    fail(`${key} must be ${max} characters or less.`);
  }

  return trimmed;
}

function integer(value: unknown, key: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    fail(`${key} must be an integer.`);
  }

  return value;
}

function oneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]) {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(`${key} must be ${allowed.join(", ")}.`);
  }

  return value as T;
}

function id(value: unknown, key: string) {
  if (typeof value !== "string" || !uuid.test(value)) {
    fail(`${key} must be an id.`);
  }

  return value.toLowerCase();
}

function dateText(value: unknown, key: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(`${key} must be a date.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    fail(`${key} must be a date.`);
  }

  return value;
}

function overlaps(left: Box, right: Box) {
  return (
    left.column < right.column + right.columns &&
    left.column + left.columns > right.column &&
    left.row < right.row + right.rows &&
    left.row + left.rows > right.row
  );
}

function card(value: unknown, index: number): ReportCard {
  const source = asObject(value, `cards[${index}]`);
  const kind = oneOf(take(source, "kind").value, "kind", ["value", "chart"] as const);
  const cardId = id(take(source, "id").value, "id");
  const title = text(take(source, "title").value, "title", 120, true);
  const descriptionField = take(source, "description");
  const description = descriptionField.has ? text(descriptionField.value, "description", 300, false) : "";
  const column = integer(take(source, "column").value, "column");
  const row = integer(take(source, "row").value, "row");
  const columns = integer(take(source, "columns").value, "columns");
  const rows = integer(take(source, "rows").value, "rows");
  const accessor = text(take(source, "accessor").value, "accessor", 200, true);
  if (column < 1 || column > reportColumnCount) {
    fail("column must be from 1 to 12.");
  }

  if (columns < 1 || column + columns - 1 > reportColumnCount) {
    fail("columns must leave the card inside column 12.");
  }

  if (row < 1 || row > reportMaxRow) {
    fail("row must be from 1 to 48.");
  }

  if (rows < 1 || row + rows - 1 > reportMaxRow) {
    fail("rows must leave the card inside row 48.");
  }

  if (!pathParts(accessor)) {
    fail("accessor must be a path such as user.hours.");
  }

  const base = { id: cardId, title, description, column, row, columns, rows, accessor };
  if (kind === "value") {
    const color = oneOf(take(source, "color").value, "color", valueColors);
    const format = oneOf(take(source, "format").value, "format", valueFormats);
    const iconField = take(source, "icon");
    const icon =
      !iconField.has || iconField.value === null ? null : oneOf(iconField.value, "icon", valueIcons);
    leftover(source, "cards");
    return { ...base, kind, color, format, icon };
  }

  const chartType = oneOf(take(source, "chartType").value, "chartType", chartTypes);
  const palette = oneOf(take(source, "palette").value, "palette", paletteTypes);
  const valueKey = oneOf(take(source, "valueKey").value, "valueKey", chartValueKeys);
  const format = oneOf(take(source, "format").value, "format", chartFormats);
  leftover(source, "cards");
  return { ...base, kind, chartType, palette, valueKey, format };
}

export function normalizeLayout(value: unknown): ReportLayout {
  const source = asObject(value, "layout");
  const version = take(source, "version").value;
  if (version !== 1) {
    fail("version must be 1.");
  }

  const cardsField = take(source, "cards").value;
  leftover(source, "layout");
  if (!Array.isArray(cardsField)) {
    fail("cards must be an array.");
  }

  if (cardsField.length > reportMaxCards) {
    fail("A report can have at most 40 cards.");
  }

  const cards = cardsField.map((item, index) => card(item, index));
  const ids = new Set<string>();
  for (const item of cards) {
    if (ids.has(item.id)) {
      fail("cards must have unique ids.");
    }

    ids.add(item.id);
    if (cards.some((other) => other.id !== item.id && overlaps(item, other))) {
      fail("Cards cannot overlap.");
    }
  }

  return { version: 1, cards };
}

const filterKeys = ["departmentId", "taskCategoryId", "projectId", "userId", "from", "to"] as const;

export function normalizeFilters(value: unknown): ReportFilters {
  if (value === undefined) {
    return {};
  }

  const source = asObject(value, "filters");
  const filters: ReportFilters = {};
  for (const key of filterKeys) {
    const field = take(source, key);
    if (!field.has || field.value === null) {
      continue;
    }

    filters[key] = key === "from" || key === "to" ? dateText(field.value, key) : id(field.value, key);
  }

  leftover(source, "filters");
  if (filters.from && filters.to && filters.from > filters.to) {
    fail("from must be on or before to.");
  }

  return filters;
}

export function normalizeReportName(value: unknown) {
  return text(value, "name", 80, true);
}

export function layoutError(value: unknown) {
  try {
    normalizeLayout(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "layout is invalid.";
  }
}

export function emptyLayout(): ReportLayout {
  return { version: 1, cards: [] };
}

function valueCard(
  column: number,
  input: Omit<ValueReportCard, "kind" | "column" | "row" | "columns" | "rows" | "description"> & {
    description?: string;
  },
): ValueReportCard {
  return {
    kind: "value",
    column,
    row: 1,
    columns: 3,
    rows: 1,
    description: "",
    ...input,
  };
}

export function summaryLayout(copy: { department: string; taskCategory: string; project: string }): ReportLayout {
  const charts: Array<Omit<ChartReportCard, "id" | "kind" | "column" | "row" | "columns" | "rows" | "description">> = [
    { title: `Hours by ${copy.department.toLowerCase()}`, accessor: "user.byDepartment", chartType: "column", palette: "single", valueKey: "hours", format: "hours" },
    { title: `Hours by ${copy.taskCategory.toLowerCase()}`, accessor: "user.byCategory", chartType: "column", palette: "single", valueKey: "hours", format: "hours" },
    { title: "In-kind by month", accessor: "user.byMonth", chartType: "column", palette: "single", valueKey: "inKind", format: "currency" },
    { title: "Hours by volunteer", accessor: "user.byVolunteer", chartType: "bar", palette: "single", valueKey: "hours", format: "hours" },
    { title: "Hours by month", accessor: "user.byMonth", chartType: "column", palette: "single", valueKey: "hours", format: "hours" },
    { title: `Hours by ${copy.project.toLowerCase()}`, accessor: "user.byProject", chartType: "bar", palette: "single", valueKey: "hours", format: "hours" },
  ];

  return {
    version: 1,
    cards: [
      valueCard(1, { id: crypto.randomUUID(), title: "Total volunteer hours", accessor: "user.hours", color: "primary", format: "hours", icon: "clock" }),
      valueCard(4, { id: crypto.randomUUID(), title: "In-kind value", accessor: "user.inKind", color: "success", format: "currency", icon: "hand-coins" }),
      valueCard(7, { id: crypto.randomUUID(), title: "Volunteers", accessor: "user.volunteers", color: "highlight", format: "number", icon: "users" }),
      valueCard(10, { id: crypto.randomUUID(), title: "Entries", accessor: "user.entries", color: "accent", format: "number", icon: "list-checks" }),
      ...charts.map((item, index): ChartReportCard => ({
        ...item,
        id: crypto.randomUUID(),
        kind: "chart",
        description: "",
        column: index % 2 === 0 ? 1 : 7,
        row: 2 + Math.floor(index / 2) * 4,
        columns: 6,
        rows: 4,
      })),
    ],
  };
}

export function collides(cards: ReportCard[], candidate: Box, ignoreId: string) {
  return cards.some((card) => card.id !== ignoreId && overlaps(card, candidate));
}

export function firstOpening(cards: ReportCard[], columns: number, rows: number) {
  for (let row = 1; row <= reportMaxRow - rows + 1; row += 1) {
    for (let column = 1; column <= reportColumnCount - columns + 1; column += 1) {
      const candidate = { column, row, columns, rows };
      if (!cards.some((card) => overlaps(card, candidate))) {
        return candidate;
      }
    }
  }

  return null;
}
