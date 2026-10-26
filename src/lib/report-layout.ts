import { chartTypes, paletteTypes, type ChartType, type PaletteType } from "@/lib/chart-palette";
import { formatPatterns, patternFor, type FormatPreset } from "@/lib/number-pattern";
import { pathParts } from "@/lib/report-path";

export const reportColumnCount = 12;
export const reportMaxRow = 48;
export const reportMaxCards = 40;

export const valueColors = ["primary", "highlight", "accent", "success"] as const;
export type ValueColor = (typeof valueColors)[number];

export const valueFormats = ["number", "hours", "currency"] as const;
export type ValueFormat = (typeof valueFormats)[number];

export const chartFormats = ["number", "hours", "currency"] as const;
export type ChartFormat = (typeof chartFormats)[number];

export const valueIcons = ["clock", "hand-coins", "users", "list-checks"] as const;
export type ValueIcon = (typeof valueIcons)[number];

export const listColumnKeys = ["name", "type", "hours", "share", "people", "inKind"] as const;
export type ListColumn = (typeof listColumnKeys)[number];

const listColumnLabels: Record<ListColumn, string> = {
  name: "Name",
  type: "Type",
  hours: "Hours",
  share: "Share",
  people: "People",
  inKind: "In-kind",
};

export function listColumnLabel(column: ListColumn) {
  return listColumnLabels[column];
}

export const chartValueKeys = ["hours", "inKind"] as const;
export type ChartValueKey = (typeof chartValueKeys)[number];

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iconName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  pattern: string;
  icon: string | null;
};

export type ChartReportCard = ReportCardBase & {
  kind: "chart";
  chartType: ChartType;
  palette: PaletteType;
  valueKey: ChartValueKey;
  format: ChartFormat;
  pattern: string;
};

export type ListReportCard = ReportCardBase & {
  kind: "list";
  format: ValueFormat;
  pattern: string;
  visibleColumns: ListColumn[];
};

export type ReportCard = ValueReportCard | ChartReportCard | ListReportCard;

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
  const kind = oneOf(take(source, "kind").value, "kind", ["value", "chart", "list"] as const);
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
    const pattern = readPattern(take(source, "pattern"), format);
    const icon = readIcon(take(source, "icon"));
    leftover(source, "cards");
    return { ...base, kind, color, format, pattern, icon };
  }

  if (kind === "list") {
    const format = oneOf(take(source, "format").value, "format", valueFormats);
    const pattern = readPattern(take(source, "pattern"), format);
    const visibleColumns = readVisibleColumns(take(source, "visibleColumns").value);
    leftover(source, "cards");
    return { ...base, kind, format, pattern, visibleColumns };
  }

  const chartType = oneOf(take(source, "chartType").value, "chartType", chartTypes);
  const palette = oneOf(take(source, "palette").value, "palette", paletteTypes);
  const valueKey = oneOf(take(source, "valueKey").value, "valueKey", chartValueKeys);
  const format = oneOf(take(source, "format").value, "format", chartFormats);
  const pattern = readPattern(take(source, "pattern"), format);
  leftover(source, "cards");
  return { ...base, kind, chartType, palette, valueKey, format, pattern };
}

function readPattern(field: { has: boolean; value: unknown }, format: FormatPreset) {
  if (!field.has || field.value === undefined) return formatPatterns[format];
  const pattern = text(field.value, "pattern", 40, true);
  return pattern || patternFor(format);
}

function readIcon(field: { has: boolean; value: unknown }) {
  if (!field.has || field.value === null) return null;
  const icon = text(field.value, "icon", 64, true);
  if (!iconName.test(icon)) fail("icon must be a Lucide icon name.");
  return icon;
}

function readVisibleColumns(value: unknown) {
  if (!Array.isArray(value)) fail("visibleColumns must be an array.");
  const seen = new Set<string>();
  const columns: ListColumn[] = [];
  for (const item of value) {
    const column = oneOf(item, "visibleColumns", listColumnKeys);
    if (seen.has(column)) fail("visibleColumns must be unique.");
    seen.add(column);
    columns.push(column);
  }
  return listColumnKeys.filter((column) => columns.includes(column));
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

export const reportTemplateIds = ["summary", "people", "groups", "staff"] as const;
export type ReportTemplateId = (typeof reportTemplateIds)[number];

const templateLabels: Record<ReportTemplateId, string> = {
  summary: "Summary",
  people: "People",
  groups: "Group sessions",
  staff: "Staff",
};

export function reportTemplateLabel(id: ReportTemplateId) {
  return templateLabels[id];
}

function templateId(slot: number) {
  return `00000000-0000-4000-8000-${slot.toString(16).padStart(12, "0")}`;
}

type TemplateCopy = { department: string; taskCategory: string; project: string };

function valueCard(
  slot: number,
  column: number,
  input: Omit<ValueReportCard, "id" | "kind" | "column" | "row" | "columns" | "rows" | "description" | "pattern"> & {
    columns?: number;
  },
): ValueReportCard {
  return {
    id: templateId(slot),
    kind: "value",
    column,
    row: 1,
    columns: input.columns ?? 3,
    rows: 1,
    description: "",
    pattern: formatPatterns[input.format],
    ...input,
  };
}

function chartCard(
  slot: number,
  index: number,
  input: Omit<ChartReportCard, "id" | "kind" | "column" | "row" | "columns" | "rows" | "description" | "pattern" | "palette">,
): ChartReportCard {
  return {
    id: templateId(slot),
    kind: "chart",
    description: "",
    palette: "single",
    pattern: formatPatterns[input.format],
    column: index % 2 === 0 ? 1 : 7,
    row: 2 + Math.floor(index / 2) * 4,
    columns: 6,
    rows: 4,
    ...input,
  };
}

function listCard(
  slot: number,
  place: { column: number; row: number },
  input: Omit<ListReportCard, "id" | "kind" | "column" | "row" | "columns" | "rows" | "description" | "pattern" | "format">,
): ListReportCard {
  return {
    id: templateId(slot),
    kind: "list",
    description: "",
    format: "hours",
    pattern: formatPatterns.hours,
    column: place.column,
    row: place.row,
    columns: 6,
    rows: 5,
    ...input,
  };
}

export function reportTemplate(id: ReportTemplateId, copy: TemplateCopy): ReportLayout {
  if (id === "people") return peopleTemplate(copy);
  if (id === "groups") return groupsTemplate(copy);
  if (id === "staff") return staffTemplate(copy);
  return summaryTemplate(copy);
}

function summaryTemplate(copy: TemplateCopy): ReportLayout {
  const charts = [
    chartCard(5, 0, { title: `Hours by ${copy.department.toLowerCase()}`, accessor: "user.byDepartment", chartType: "column", valueKey: "hours", format: "hours" }),
    chartCard(6, 1, { title: `Hours by ${copy.taskCategory.toLowerCase()}`, accessor: "user.byCategory", chartType: "column", valueKey: "hours", format: "hours" }),
    chartCard(7, 2, { title: "In-kind by month", accessor: "user.byMonth", chartType: "column", valueKey: "inKind", format: "currency" }),
    chartCard(8, 3, { title: "Hours by volunteer", accessor: "user.byVolunteer", chartType: "bar", valueKey: "hours", format: "hours" }),
    chartCard(9, 4, { title: "Hours by month", accessor: "user.byMonth", chartType: "column", valueKey: "hours", format: "hours" }),
    chartCard(10, 5, { title: `Hours by ${copy.project.toLowerCase()}`, accessor: "user.byProject", chartType: "bar", valueKey: "hours", format: "hours" }),
  ];
  return { version: 1, cards: [...volunteerTotals(1), ...charts] };
}

function peopleTemplate(copy: TemplateCopy): ReportLayout {
  const measure: ListColumn[] = ["name", "hours", "share", "inKind"];
  return {
    version: 1,
    cards: [
      ...volunteerTotals(20),
      listCard(24, { column: 1, row: 2 }, { title: `By ${copy.project.toLowerCase()}`, accessor: "user.byProject", visibleColumns: ["name", "type", "hours", "share", "people", "inKind"] }),
      listCard(25, { column: 7, row: 2 }, { title: "By person", accessor: "user.byPerson", visibleColumns: measure }),
      listCard(26, { column: 1, row: 7 }, { title: `By ${copy.department.toLowerCase()}`, accessor: "user.byDepartment", visibleColumns: ["name", "hours", "share", "people", "inKind"] }),
      listCard(27, { column: 7, row: 7 }, { title: `By ${copy.taskCategory.toLowerCase()}`, accessor: "user.byCategory", visibleColumns: ["name", "hours", "share", "people", "inKind"] }),
    ],
  };
}

function groupsTemplate(copy: TemplateCopy): ReportLayout {
  const measure: ListColumn[] = ["name", "hours", "share", "inKind"];
  return {
    version: 1,
    cards: [
      valueCard(30, 1, { title: "Hours", accessor: "collective.hours", color: "primary", format: "hours", icon: "clock", columns: 4 }),
      valueCard(31, 5, { title: "In-kind value", accessor: "collective.inKind", color: "success", format: "currency", icon: "hand-coins", columns: 4 }),
      valueCard(32, 9, { title: "Sessions", accessor: "collective.entries", color: "accent", format: "number", icon: "list-checks", columns: 4 }),
      listCard(33, { column: 1, row: 2 }, { title: `By ${copy.project.toLowerCase()}`, accessor: "collective.byProject", visibleColumns: ["name", "type", "hours", "share", "inKind"] }),
      listCard(34, { column: 7, row: 2 }, { title: `By ${copy.department.toLowerCase()}`, accessor: "collective.byDepartment", visibleColumns: measure }),
      listCard(35, { column: 1, row: 7 }, { title: `By ${copy.taskCategory.toLowerCase()}`, accessor: "collective.byCategory", visibleColumns: measure }),
    ],
  };
}

function staffTemplate(copy: TemplateCopy): ReportLayout {
  const measure: ListColumn[] = ["name", "hours", "share", "inKind"];
  return {
    version: 1,
    cards: [
      valueCard(40, 1, { title: "Staff hours", accessor: "staff.hours", color: "primary", format: "hours", icon: "clock" }),
      valueCard(41, 4, { title: "In-kind value", accessor: "staff.inKind", color: "success", format: "currency", icon: "hand-coins" }),
      valueCard(42, 7, { title: "Staff", accessor: "staff.volunteers", color: "highlight", format: "number", icon: "users" }),
      valueCard(43, 10, { title: "Entries", accessor: "staff.entries", color: "accent", format: "number", icon: "list-checks" }),
      listCard(44, { column: 1, row: 2 }, { title: `By ${copy.department.toLowerCase()}`, accessor: "staff.byDepartment", visibleColumns: measure }),
      listCard(45, { column: 7, row: 2 }, { title: `By ${copy.project.toLowerCase()}`, accessor: "staff.byProject", visibleColumns: ["name", "type", "hours", "share", "inKind"] }),
      listCard(46, { column: 1, row: 7 }, { title: "By person", accessor: "staff.byPerson", visibleColumns: measure }),
    ],
  };
}

function volunteerTotals(slot: number): ValueReportCard[] {
  return [
    valueCard(slot, 1, { title: "Total volunteer hours", accessor: "user.hours", color: "primary", format: "hours", icon: "clock" }),
    valueCard(slot + 1, 4, { title: "In-kind value", accessor: "user.inKind", color: "success", format: "currency", icon: "hand-coins" }),
    valueCard(slot + 2, 7, { title: "Volunteers", accessor: "user.volunteers", color: "highlight", format: "number", icon: "users" }),
    valueCard(slot + 3, 10, { title: "Entries", accessor: "user.entries", color: "accent", format: "number", icon: "list-checks" }),
  ];
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
