"use client";

import { useRef, useState, type PointerEvent } from "react";
import { cn } from "cn";
import { ChartCard } from "@/components/chart-card";
import { ReportGridItem } from "@/components/report-grid-item";
import { ValueCard } from "@/components/value-card";
import { collides, reportColumnCount, reportMaxRow, type ReportCard } from "@/lib/report-layout";

export const reportGridGap = 12;
export const reportRowHeight = 112;

type Drag =
  | { id: string; mode: "move"; originColumn: number; originRow: number; pointerColumn: number; pointerRow: number }
  | { id: string; mode: "left"; right: number }
  | { id: string; mode: "bottom" };

function cellFromPointer(grid: HTMLElement, clientX: number, clientY: number) {
  const rect = grid.getBoundingClientRect();
  const columnWidth = (rect.width - reportGridGap * (reportColumnCount - 1)) / reportColumnCount;
  const column = Math.min(
    reportColumnCount,
    Math.max(1, Math.floor((clientX - rect.left) / (columnWidth + reportGridGap)) + 1),
  );
  const row = Math.max(1, Math.floor((clientY - rect.top) / (reportRowHeight + reportGridGap)) + 1);
  return { column, row };
}

function placed(card: ReportCard, drag: Drag, cell: { column: number; row: number }) {
  if (drag.mode === "move") {
    return {
      ...card,
      column: Math.min(Math.max(1, drag.originColumn + cell.column - drag.pointerColumn), reportColumnCount - card.columns + 1),
      row: Math.min(Math.max(1, drag.originRow + cell.row - drag.pointerRow), reportMaxRow - card.rows + 1),
    };
  }

  if (drag.mode === "left") {
    const column = Math.min(Math.max(1, cell.column), drag.right);
    return { ...card, column, columns: drag.right - column + 1 };
  }

  return { ...card, rows: Math.min(Math.max(1, cell.row - card.row + 1), reportMaxRow - card.row + 1) };
}

export function ReportGrid({
  cards,
  data,
  editing = false,
  selectedId,
  onSelect,
  onChange,
}: {
  cards: ReportCard[];
  data: unknown;
  editing?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange?: (cards: ReportCard[]) => void;
}) {
  const [draft, setDraft] = useState<ReportCard[] | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const shown = draft ?? cards;
  const occupied = shown.reduce((max, card) => Math.max(max, card.row + card.rows - 1), 0);
  const rowCount = Math.max(occupied + (editing ? 1 : 0), editing ? 1 : occupied);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!editing || event.button !== 0) return;
    const target = event.target as HTMLElement;
    const resize = target.closest("[data-resize]")?.getAttribute("data-resize");
    if (!resize && target.closest("button, a, input, textarea, select, [role='menuitem']")) return;
    const cardNode = target.closest("[data-card-id]");
    const id = cardNode?.getAttribute("data-card-id");
    if (!id) return;
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    onSelect?.(id);
    const cell = cellFromPointer(event.currentTarget, event.clientX, event.clientY);
    dragRef.current =
      resize === "left"
        ? { id, mode: "left", right: card.column + card.columns - 1 }
        : resize === "bottom"
          ? { id, mode: "bottom" }
          : {
              id,
              mode: "move",
              originColumn: card.column,
              originRow: card.row,
              pointerColumn: cell.column,
              pointerRow: cell.row,
            };
    setDraft(cards);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const cell = cellFromPointer(event.currentTarget, event.clientX, event.clientY);
    const card = cards.find((item) => item.id === drag.id);
    if (!card) return;
    const next = placed(card, drag, cell);
    if (collides(cards, next, drag.id)) return;
    setDraft(cards.map((item) => (item.id === drag.id ? next : item)));
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setDraft((current) => {
      if (current && JSON.stringify(current) !== JSON.stringify(cards)) {
        onChange?.(current);
      }
      return null;
    });
  }

  if (!editing && cards.length === 0) {
    return <p className="text-sm text-muted-foreground">This report has no cards yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div
        className={cn("grid", editing && "rounded-xl bg-muted/40 p-1 select-none")}
        style={{
          gridTemplateColumns: `repeat(${reportColumnCount}, minmax(4.5rem, 1fr))`,
          gridTemplateRows: `repeat(${Math.max(rowCount, 1)}, ${reportRowHeight}px)`,
          gap: reportGridGap,
          minWidth: reportColumnCount * 72 + (reportColumnCount - 1) * reportGridGap,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {shown.map((card) => (
          <ReportGridItem
            key={card.id}
            cardId={card.id}
            column={card.column}
            row={card.row}
            columns={card.columns}
            rows={card.rows}
            accessor={card.accessor}
            data={data}
            editing={editing}
            selected={selectedId === card.id}
            title={card.title}
          >
            {card.kind === "value" ? (
              <ValueCard
                title={card.title}
                description={card.description}
                color={card.color}
                format={card.format}
                icon={card.icon}
              />
            ) : (
              <ChartCard
                title={card.title}
                description={card.description || undefined}
                rows={[]}
                chartType={card.chartType}
                palette={card.palette}
                valueKey={card.valueKey}
                format={card.format}
                configurable={editing}
                onChartTypeChange={(chartType) =>
                  onChange?.(cards.map((item) => (item.id === card.id && item.kind === "chart" ? { ...item, chartType } : item)))
                }
                onPaletteChange={(palette) =>
                  onChange?.(cards.map((item) => (item.id === card.id && item.kind === "chart" ? { ...item, palette } : item)))
                }
              />
            )}
          </ReportGridItem>
        ))}
      </div>
    </div>
  );
}
