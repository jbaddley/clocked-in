import {
  firstOpening,
  layoutError,
  overlaps,
  reportColumnCount,
  reportMaxRow,
  type ReportBox,
  type ReportCard,
} from "@/lib/report-layout";

export type MoveTarget = {
  kind: "seat" | "bump";
  column: number;
  row: number;
  cards: ReportCard[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sharesRowBand(left: ReportBox, right: ReportBox) {
  return left.row < right.row + right.rows && right.row < left.row + left.rows;
}

function visualOrder(left: ReportCard, right: ReportCard) {
  return left.row - right.row || left.column - right.column;
}

function occupiesColumn(card: ReportCard, column: number) {
  return card.column <= column && column <= card.column + card.columns - 1;
}

function bandOccupancy(others: ReportCard[], row: number, rows: number) {
  const occupied = Array.from({ length: reportColumnCount + 1 }, () => false);
  const band = { column: 1, row, columns: reportColumnCount, rows };
  for (const card of others) {
    if (!sharesRowBand(card, band)) continue;
    const start = Math.max(1, card.column);
    const end = Math.min(reportColumnCount, card.column + card.columns - 1);
    for (let column = start; column <= end; column += 1) {
      occupied[column] = true;
    }
  }
  return occupied;
}

function emptyRun(occupied: boolean[], column: number) {
  if (column < 1 || column > reportColumnCount || occupied[column]) return null;
  let start = column;
  while (start > 1 && !occupied[start - 1]) start -= 1;
  let end = column;
  while (end < reportColumnCount && !occupied[end + 1]) end += 1;
  return { start, end };
}

function withDragged(others: ReportCard[], dragged: ReportCard, column: number, row: number) {
  return [...others, { ...dragged, column, row }];
}

function emptySeat(
  others: ReportCard[],
  dragged: ReportCard,
  preferredColumn: number,
  row: number,
  pointerColumn: number,
): MoveTarget | null {
  const width = dragged.columns;
  const run = emptyRun(bandOccupancy(others, row, dragged.rows), pointerColumn);
  if (!run || run.end - run.start + 1 < width) return null;
  const column = clamp(preferredColumn, run.start, run.end - width + 1);
  const seat = { column, row, columns: width, rows: dragged.rows };
  if (others.some((card) => overlaps(card, seat))) return null;
  return { kind: "seat", column, row, cards: withDragged(others, dragged, column, row) };
}

function previewBump(
  others: ReportCard[],
  dragged: ReportCard,
  pointer: { column: number; row: number },
  row: number,
): MoveTarget | null {
  const width = dragged.columns;
  const band = { column: 1, row, columns: reportColumnCount, rows: dragged.rows };
  const under = others.find((card) => sharesRowBand(card, band) && occupiesColumn(card, pointer.column));
  const column = clamp(under ? under.column : pointer.column, 1, reportColumnCount - width + 1);
  const inserted = { ...dragged, column, row };
  const bandCards = others.filter((card) => sharesRowBand(card, inserted));
  const candidates = bandCards.filter((card) => card.column >= column);
  const candidateIds = new Set(candidates.map((card) => card.id));
  if (others.some((card) => !candidateIds.has(card.id) && overlaps(card, inserted))) return null;

  const stayed: ReportCard[] = [];
  const overflow: ReportCard[] = [];
  for (const card of [...candidates].sort(visualOrder)) {
    const shifted = { ...card, column: card.column + width };
    if (shifted.column + shifted.columns - 1 <= reportColumnCount) {
      stayed.push(shifted);
    } else {
      overflow.push(card);
    }
  }

  let settled = others.filter((card) => !candidateIds.has(card.id));
  const occupancy: ReportCard[] = [inserted, ...stayed];
  const queue: ReportCard[] = [];
  const queued = new Set<string>();

  function enqueueOverlaps(box: ReportBox) {
    const remaining: ReportCard[] = [];
    for (const card of settled) {
      if (overlaps(card, box)) {
        if (!queued.has(card.id)) {
          queue.push(card);
          queued.add(card.id);
        }
      } else {
        remaining.push(card);
      }
    }
    settled = remaining;
  }

  enqueueOverlaps(inserted);
  for (const card of stayed) enqueueOverlaps(card);
  for (const card of overflow) {
    if (!queued.has(card.id)) {
      queue.push(card);
      queued.add(card.id);
    }
  }

  const startRow = row + dragged.rows;
  while (queue.length > 0) {
    queue.sort(visualOrder);
    const card = queue.shift();
    if (!card) break;
    const opening = firstOpening(occupancy, card.columns, card.rows, startRow);
    if (!opening || opening.row + card.rows - 1 > reportMaxRow) return null;
    const placed = { ...card, column: opening.column, row: opening.row };
    enqueueOverlaps(placed);
    occupancy.push(placed);
  }

  const cards = [...occupancy, ...settled];
  if (layoutError({ version: 1, cards })) return null;
  return { kind: "bump", column, row, cards };
}

export function resolveMoveTarget(
  cards: ReportCard[],
  draggedId: string,
  preferred: { column: number; row: number },
  pointer: { column: number; row: number },
): MoveTarget | null {
  const dragged = cards.find((card) => card.id === draggedId);
  if (!dragged) return null;
  const width = dragged.columns;
  const height = dragged.rows;
  const row = clamp(preferred.row, 1, reportMaxRow - height + 1);
  const preferredColumn = clamp(preferred.column, 1, reportColumnCount - width + 1);
  const others = cards.filter((card) => card.id !== draggedId);
  return emptySeat(others, dragged, preferredColumn, row, pointer.column) ?? previewBump(others, dragged, pointer, row);
}

export function reflowAfterDrop(cards: ReportCard[], droppedId: string) {
  const dropped = cards.find((card) => card.id === droppedId);
  if (!dropped) return cards;
  let others = cards.filter((card) => card.id !== droppedId);
  let moved = true;
  while (moved) {
    moved = false;
    others = [...others].sort(visualOrder);
    for (let index = 0; index < others.length; index += 1) {
      const card = others[index];
      const occupancy = [dropped, ...others.filter((item) => item.id !== card.id)];
      let next: ReportBox | null = null;
      for (let row = 1; row <= card.row; row += 1) {
        for (let column = 1; column <= reportColumnCount - card.columns + 1; column += 1) {
          const candidate = { column, row, columns: card.columns, rows: card.rows };
          if (occupancy.some((item) => overlaps(item, candidate))) continue;
          next = candidate;
          break;
        }
        if (next) break;
      }
      if (next && (next.column !== card.column || next.row !== card.row)) {
        others[index] = { ...card, column: next.column, row: next.row };
        moved = true;
      }
    }
  }
  return [dropped, ...others];
}
