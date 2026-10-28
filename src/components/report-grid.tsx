"use client";

import { useRef, useState, type PointerEvent, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { ChartCard } from "@/components/chart-card";
import { EntriesCard } from "@/components/entries-card";
import { GroupTable } from "@/components/group-table";
import { ReportGridItem } from "@/components/report-grid-item";
import { ValueCard } from "@/components/value-card";
import { reflowAfterDrop, resolveMoveTarget, type MoveTarget } from "@/lib/report-drag";
import { patternFor } from "@/lib/number-pattern";
import { entriesHrefFromAccessor } from "@/lib/entries-href";
import { collides, reportColumnCount, reportMaxRow, type ReportCard, type ReportFilters } from "@/lib/report-layout";

export const reportGridGap = 12;
export const reportRowHeight = 112;

type Drag =
  | {
      id: string;
      mode: "move";
      originColumn: number;
      originRow: number;
      pointerColumn: number;
      pointerRow: number;
      grabOffsetX: number;
      grabOffsetY: number;
      width: number;
      height: number;
    }
  | { id: string; mode: "left"; right: number }
  | { id: string; mode: "right"; column: number }
  | { id: string; mode: "top"; bottom: number }
  | { id: string; mode: "bottom" };

type Lift = { id: string; left: number; top: number; width: number; height: number };

function cellFromPointer(grid: HTMLElement, clientX: number, clientY: number, gap: number, rowHeight: number) {
  const rect = grid.getBoundingClientRect();
  const scaleX = rect.width / grid.offsetWidth || 1;
  const scaleY = rect.height / grid.offsetHeight || 1;
  const x = (clientX - rect.left) / scaleX;
  const y = (clientY - rect.top) / scaleY;
  const columnWidth = (grid.offsetWidth - gap * (reportColumnCount - 1)) / reportColumnCount;
  const column = Math.min(reportColumnCount, Math.max(1, Math.floor(x / (columnWidth + gap)) + 1));
  const row = Math.max(1, Math.floor(y / (rowHeight + gap)) + 1);
  return { column, row };
}

function preferredOrigin(card: ReportCard, drag: Extract<Drag, { mode: "move" }>, cell: { column: number; row: number }) {
  return {
    column: Math.min(Math.max(1, drag.originColumn + cell.column - drag.pointerColumn), reportColumnCount - card.columns + 1),
    row: Math.min(Math.max(1, drag.originRow + cell.row - drag.pointerRow), reportMaxRow - card.rows + 1),
  };
}

function placed(card: ReportCard, drag: Exclude<Drag, { mode: "move" }>, cell: { column: number; row: number }) {
  if (drag.mode === "left") {
    const column = Math.min(Math.max(1, cell.column), drag.right);
    return { ...card, column, columns: drag.right - column + 1 };
  }

  if (drag.mode === "right") {
    const right = Math.min(reportColumnCount, Math.max(drag.column, cell.column));
    return { ...card, column: drag.column, columns: right - drag.column + 1 };
  }

  if (drag.mode === "top") {
    const row = Math.min(drag.bottom, Math.max(1, cell.row));
    return { ...card, row, rows: drag.bottom - row + 1 };
  }

  return { ...card, rows: Math.min(Math.max(1, cell.row - card.row + 1), reportMaxRow - card.row + 1) };
}

function cardBody(
  card: ReportCard,
  cards: ReportCard[],
  onChange?: (cards: ReportCard[]) => void,
  drilldown?: { filters?: ReportFilters; enabled?: boolean },
): ReactElement {
  const href = drilldown?.enabled === false ? undefined : entriesHrefFromAccessor(card.accessor, { filters: drilldown?.filters });
  const rowHref =
    drilldown?.enabled === false
      ? undefined
      : (row: { id: string }) => entriesHrefFromAccessor(card.accessor, { filters: drilldown?.filters, rowId: row.id });
  if (card.kind === "value") {
    return (
      <ValueCard
        title={card.title}
        description={card.description}
        color={card.color}
        pattern={card.pattern || patternFor(card.format)}
        icon={card.icon}
        href={href}
      />
    );
  }

  if (card.kind === "list") {
    return (
      <GroupTable
        title={card.title}
        description={card.description || undefined}
        rows={[]}
        visibleColumns={card.visibleColumns}
        hoursPattern={card.pattern || patternFor(card.format)}
        sortKey={card.sortKey}
        sortDir={card.sortDir}
        limit={card.limit}
        rowHref={rowHref}
      />
    );
  }

  if (card.kind === "entries") {
    return <EntriesCard title={card.title} description={card.description || undefined} limit={card.limit} href={href} />;
  }

  return (
    <ChartCard
      key={`${card.id}-${card.chartType}-${card.palette}`}
      title={card.title}
      description={card.description || undefined}
      rows={[]}
      chartType={card.chartType}
      palette={card.palette}
      valueKey={card.valueKey}
      format={card.format}
      pattern={card.pattern || patternFor(card.format)}
      href={href}
      rowHref={rowHref}
      onChartTypeChange={(chartType) =>
        onChange?.(cards.map((item) => (item.id === card.id && item.kind === "chart" ? { ...item, chartType } : item)))
      }
      onPaletteChange={(palette) =>
        onChange?.(cards.map((item) => (item.id === card.id && item.kind === "chart" ? { ...item, palette } : item)))
      }
    />
  );
}

export function ReportGrid({
  cards,
  data,
  editing = false,
  scroll = true,
  selectedId,
  onSelect,
  onChange,
  filters,
}: {
  cards: ReportCard[];
  data: unknown;
  editing?: boolean;
  scroll?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange?: (cards: ReportCard[]) => void;
  filters?: ReportFilters;
}) {
  const [draft, setDraft] = useState<ReportCard[] | null>(null);
  const [lift, setLift] = useState<Lift | null>(null);
  const [target, setTarget] = useState<MoveTarget | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const targetRef = useRef<MoveTarget | null>(null);
  const layout = draft ?? cards;
  const movingId = lift?.id ?? null;
  const shown = layout.filter((card) => card.id !== movingId);
  const occupied = layout.reduce((max, card) => Math.max(max, card.row + card.rows - 1), 0);
  const rowCount = Math.max(occupied + (editing ? 1 : 0), editing ? 1 : occupied);
  const gap = reportGridGap;
  const rowHeight = reportRowHeight;
  const dragged = movingId ? cards.find((card) => card.id === movingId) : null;

  function setMoveTarget(next: MoveTarget | null) {
    targetRef.current = next;
    setTarget(next);
    setDraft(next?.cards ?? cards);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!editing || event.button !== 0) return;
    const targetNode = event.target as HTMLElement;
    const resize = targetNode.closest("[data-resize]")?.getAttribute("data-resize");
    if (!resize && targetNode.closest("button, a, input, textarea, select, [role='menuitem']")) return;
    const cardNode = targetNode.closest("[data-card-id]");
    if (!(cardNode instanceof HTMLElement)) return;
    const id = cardNode.getAttribute("data-card-id");
    if (!id) return;
    const card = cards.find((item) => item.id === id);
    if (!card) return;
    onSelect?.(id);
    const cell = cellFromPointer(event.currentTarget, event.clientX, event.clientY, gap, rowHeight);
    const rightEdge = card.column + card.columns - 1;
    const bottomEdge = card.row + card.rows - 1;
    if (resize === "left" || resize === "right" || resize === "top" || resize === "bottom") {
      dragRef.current =
        resize === "left"
          ? { id, mode: "left", right: rightEdge }
          : resize === "right"
            ? { id, mode: "right", column: card.column }
            : resize === "top"
              ? { id, mode: "top", bottom: bottomEdge }
              : { id, mode: "bottom" };
      setDraft(cards);
    } else {
      const rect = cardNode.getBoundingClientRect();
      const drag: Extract<Drag, { mode: "move" }> = {
        id,
        mode: "move",
        originColumn: card.column,
        originRow: card.row,
        pointerColumn: cell.column,
        pointerRow: cell.row,
        grabOffsetX: event.clientX - rect.left,
        grabOffsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      dragRef.current = drag;
      setLift({
        id,
        left: event.clientX - drag.grabOffsetX,
        top: event.clientY - drag.grabOffsetY,
        width: drag.width,
        height: drag.height,
      });
      setMoveTarget(resolveMoveTarget(cards, id, preferredOrigin(card, drag, cell), cell));
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const cell = cellFromPointer(event.currentTarget, event.clientX, event.clientY, gap, rowHeight);
    const card = cards.find((item) => item.id === drag.id);
    if (!card) return;
    if (drag.mode === "move") {
      setLift({
        id: drag.id,
        left: event.clientX - drag.grabOffsetX,
        top: event.clientY - drag.grabOffsetY,
        width: drag.width,
        height: drag.height,
      });
      setMoveTarget(resolveMoveTarget(cards, drag.id, preferredOrigin(card, drag, cell), cell));
      return;
    }
    const next = placed(card, drag, cell);
    if (collides(cards, next, drag.id)) return;
    setDraft(cards.map((item) => (item.id === drag.id ? next : item)));
  }

  function clearDrag() {
    dragRef.current = null;
    targetRef.current = null;
    setLift(null);
    setTarget(null);
    setDraft(null);
  }

  function onPointerUp() {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "move") {
      const next = targetRef.current;
      clearDrag();
      if (!next) return;
      const committed = reflowAfterDrop(next.cards, drag.id);
      if (JSON.stringify(committed) !== JSON.stringify(cards)) {
        onChange?.(committed);
      }
      return;
    }
    dragRef.current = null;
    setDraft((current) => {
      if (current && JSON.stringify(current) !== JSON.stringify(cards)) {
        onChange?.(current);
      }
      return null;
    });
  }

  function onPointerCancel() {
    if (dragRef.current?.mode === "move") {
      clearDrag();
      return;
    }
    onPointerUp();
  }

  if (!editing && cards.length === 0) {
    return <p className="text-sm text-muted-foreground">This report has no cards yet.</p>;
  }

  const lifted = dragged && lift ? (
    <ReportGridItem
      cardId={dragged.id}
      column={dragged.column}
      row={dragged.row}
      columns={dragged.columns}
      rows={dragged.rows}
      accessor={dragged.accessor}
      data={data}
      editing
      floating
      selected
      title={dragged.title}
      style={{
        position: "fixed",
        left: lift.left,
        top: lift.top,
        width: lift.width,
        height: lift.height,
      }}
    >
      {cardBody(dragged, cards, onChange, { filters, enabled: !editing })}
    </ReportGridItem>
  ) : null;

  return (
    <div className={cn(scroll && "overflow-x-auto")}>
      <div
        className={cn("grid", editing && "rounded-xl bg-muted/40 p-1 select-none")}
        style={{
          gridTemplateColumns: `repeat(${reportColumnCount}, minmax(4.5rem, 1fr))`,
          gridTemplateRows: `repeat(${Math.max(rowCount, 1)}, ${rowHeight}px)`,
          gap,
          minWidth: reportColumnCount * 72 + (reportColumnCount - 1) * gap,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
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
            {cardBody(card, cards, onChange, { filters, enabled: !editing })}
          </ReportGridItem>
        ))}
        {target && dragged ? (
          <div
            aria-label="Drop Card here"
            className="pointer-events-none rounded-xl bg-primary/20 ring-2 ring-primary/40"
            style={{
              gridColumn: `${target.column} / span ${dragged.columns}`,
              gridRow: `${target.row} / span ${dragged.rows}`,
            }}
          />
        ) : null}
        {target?.kind === "bump" && dragged ? (
          <div
            aria-hidden
            className="pointer-events-none z-10 flex"
            style={{
              gridColumn: `${target.column} / span 1`,
              gridRow: `${target.row} / span ${dragged.rows}`,
            }}
          >
            <div className="w-6 self-stretch rounded-full bg-primary/70 shadow-sm" />
          </div>
        ) : null}
      </div>
      {lifted && typeof document !== "undefined" ? createPortal(lifted, document.body) : null}
    </div>
  );
}
