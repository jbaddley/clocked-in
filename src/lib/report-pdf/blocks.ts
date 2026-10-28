import { colorsForPalette, defaultPalette, seriesColor, type ChartPaletteSource } from "@/lib/chart-palette";
import { formatDate } from "@/lib/format";
import { formatWithPattern } from "@/lib/number-pattern";
import {
  cardsInReadingOrder,
  listColumnLabel,
  presentListRows,
  type ChartReportCard,
  type ListColumn,
  type ReportCard,
} from "@/lib/report-layout";
import { getPath } from "@/lib/report-path";
import { pageContentHeight, shouldStartNewPage } from "@/lib/report-pdf/layout";
import type { ReportGroup, TimeEntry } from "@/lib/types";

export type PdfKpi = { title: string; value: string };

export type PdfLegendItem = { label: string; value: string; color: string };

export type PdfBlock =
  | { kind: "kpis"; items: PdfKpi[] }
  | { kind: "table"; title: string; headers: string[]; rows: string[][] }
  | {
      kind: "chart";
      id: string;
      title: string;
      card: ChartReportCard;
      rows: ReportGroup[];
      colors: string[];
      legend: PdfLegendItem[];
      image: string | null;
      width: number;
      height: number;
    };

function asGroups(value: unknown) {
  return Array.isArray(value) ? (value as ReportGroup[]) : [];
}

function displayValue(value: unknown, pattern: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return formatWithPattern(value, pattern);
}

function listCells(row: ReportGroup, columns: ListColumn[], totalHours: number, pattern: string) {
  return columns.map((column) => {
    if (column === "name") return row.label;
    if (column === "type") return row.projectType ?? "";
    if (column === "hours") return formatWithPattern(row.hours, pattern);
    if (column === "share") {
      const percent = totalHours > 0 ? Math.round((row.hours / totalHours) * 100) : 0;
      return `${percent}%`;
    }
    if (column === "people") return String(row.volunteers);
    return formatWithPattern(row.inKind, "$0,0.00");
  });
}

function flushKpis(items: PdfKpi[], blocks: PdfBlock[]) {
  if (items.length === 0) return;
  blocks.push({ kind: "kpis", items: items.splice(0, items.length) });
}

export function reportPdfBlocks(cards: ReportCard[], data: unknown, theme: ChartPaletteSource): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const kpis: PdfKpi[] = [];

  for (const card of cardsInReadingOrder(cards)) {
    const resolved = getPath(data, card.accessor);
    if (card.kind === "value") {
      kpis.push({ title: card.title, value: displayValue(resolved, card.pattern) });
      if (kpis.length === 4) flushKpis(kpis, blocks);
      continue;
    }

    flushKpis(kpis, blocks);

    if (card.kind === "entries") {
      const entries = Array.isArray(resolved) ? (resolved as TimeEntry[]) : [];
      blocks.push({
        kind: "table",
        title: card.title,
        headers: ["Date", "Hours", "Notes"],
        rows: entries.slice(0, card.limit).map((entry) => [
          entry.occurredOn ? formatDate(entry.occurredOn) : "",
          formatWithPattern((entry.durationMinutes ?? 0) / 60, "0,0.[00]"),
          entry.description ?? "",
        ]),
      });
      continue;
    }

    if (card.kind === "list") {
      const presented = presentListRows(asGroups(resolved), card);
      const total = presented.reduce((sum, row) => sum + row.hours, 0);
      const columns = card.visibleColumns.length > 0 ? card.visibleColumns : (["name", "hours", "inKind"] as ListColumn[]);
      blocks.push({
        kind: "table",
        title: card.title,
        headers: columns.map((column) => listColumnLabel(column)),
        rows: presented.map((row) => listCells(row, columns, total, card.pattern)),
      });
      continue;
    }

    const rows = asGroups(resolved);
    const palette = defaultPalette(card.chartType, card.palette);
    const colors = colorsForPalette(theme, palette);
    const valueKey = card.valueKey;
    blocks.push({
      kind: "chart",
      id: card.id,
      title: card.title,
      card,
      rows,
      colors,
      legend: rows.map((row, index) => ({
        label: row.label,
        value: formatWithPattern(row[valueKey], card.pattern),
        color: seriesColor(colors, index),
      })),
      image: null,
      width: 540,
      height: 240,
    });
  }

  flushKpis(kpis, blocks);
  return blocks;
}

const tableTitleHeight = 20;
const tableHeaderHeight = 18;
const tableRowHeight = 16;

export function estimatedBlockHeight(block: PdfBlock) {
  if (block.kind === "kpis") return 56;
  if (block.kind === "table") {
    return tableTitleHeight + tableHeaderHeight + block.rows.length * tableRowHeight;
  }
  return 36 + block.height + Math.min(block.legend.length, 8) * 12;
}

function rowsThatFit(remaining: number, pageHeight: number) {
  const overhead = tableTitleHeight + tableHeaderHeight;
  const space = Math.min(remaining, pageHeight);
  return Math.max(1, Math.floor((space - overhead) / tableRowHeight));
}

export function paginatePdfBlocks(blocks: PdfBlock[], firstPageBudget: number, pageBudget = pageContentHeight) {
  const pages: PdfBlock[][] = [[]];
  let remaining = firstPageBudget;

  function pageHeight() {
    return pages.length === 1 ? firstPageBudget : pageBudget;
  }

  function startPageIfNeeded(needed: number) {
    if (pages[pages.length - 1].length > 0 && shouldStartNewPage(remaining, needed, pageHeight())) {
      pages.push([]);
      remaining = pageBudget;
    }
  }

  function push(block: PdfBlock) {
    const needed = estimatedBlockHeight(block);
    startPageIfNeeded(needed);
    pages[pages.length - 1].push(block);
    remaining -= needed;
  }

  for (const block of blocks) {
    if (block.kind !== "table" || block.rows.length === 0) {
      push(block);
      continue;
    }

    let offset = 0;
    while (offset < block.rows.length) {
      startPageIfNeeded(tableTitleHeight + tableHeaderHeight + tableRowHeight);
      const fit = rowsThatFit(remaining, pageHeight());
      const rows = block.rows.slice(offset, offset + fit);
      push({ ...block, rows });
      offset += rows.length;
    }
  }

  return pages;
}
