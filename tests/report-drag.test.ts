import assert from "node:assert/strict";
import test from "node:test";
import { reflowAfterDrop, resolveMoveTarget } from "../src/lib/report-drag";
import { normalizeLayout, type ReportCard, type ValueReportCard } from "../src/lib/report-layout";

function id(slot: number) {
  return `00000000-0000-4000-8000-${slot.toString(16).padStart(12, "0")}`;
}

function card(slot: number, column: number, row: number, columns: number, rows = 1): ValueReportCard {
  return {
    id: id(slot),
    kind: "value",
    title: `Card ${slot}`,
    description: "",
    accessor: "user.hours",
    column,
    row,
    columns,
    rows,
    color: "primary",
    format: "hours",
    pattern: "0.0",
    icon: null,
  };
}

function placed(cards: ReportCard[], draggedId: string) {
  return cards.find((item) => item.id === draggedId);
}

function at(cards: ReportCard[], slot: number) {
  return cards.find((item) => item.id === id(slot));
}

test("empty seat is the dragged Card size and tracks the pointer inside the run", () => {
  const dragged = card(1, 1, 1, 4);
  const neighbor = card(2, 1, 2, 6);
  const cards = [dragged, neighbor];
  const target = resolveMoveTarget(cards, dragged.id, { column: 8, row: 2 }, { column: 9, row: 2 });
  assert.ok(target);
  assert.equal(target.kind, "seat");
  assert.equal(target.column, 8);
  assert.equal(target.row, 2);
  assert.equal(target.cards.find((item) => item.id === dragged.id)?.columns, 4);
  normalizeLayout({ version: 1, cards: target.cards });
});

test("empty seat is rejected when the run is narrower than the dragged Card", () => {
  const dragged = card(1, 1, 3, 6);
  const left = card(2, 1, 1, 5);
  const right = card(3, 8, 1, 5);
  const target = resolveMoveTarget([dragged, left, right], dragged.id, { column: 6, row: 1 }, { column: 6, row: 1 });
  assert.ok(!target || target.kind === "bump");
  if (target?.kind === "seat") {
    assert.fail("narrow run must not be an empty seat");
  }
});

test("in-row bump shifts Cards to the right by W and keeps them on the row-band", () => {
  const dragged = card(1, 1, 3, 3);
  const left = card(2, 1, 1, 3);
  const right = card(3, 4, 1, 3);
  const target = resolveMoveTarget([dragged, left, right], dragged.id, { column: 4, row: 1 }, { column: 4, row: 1 });
  assert.ok(target);
  assert.equal(target.kind, "bump");
  assert.equal(target.column, 4);
  assert.equal(target.row, 1);
  assert.deepEqual(at(target.cards, 2), { ...left, column: 1, row: 1 });
  assert.deepEqual(at(target.cards, 3), { ...right, column: 7, row: 1 });
  assert.equal(placed(target.cards, dragged.id)?.column, 4);
  normalizeLayout({ version: 1, cards: target.cards });
});

test("overflow places Cards below the insertion row-band with firstOpening", () => {
  const dragged = card(1, 1, 6, 6);
  const a = card(2, 1, 1, 4);
  const b = card(3, 5, 1, 4);
  const c = card(4, 9, 1, 4);
  const target = resolveMoveTarget([dragged, a, b, c], dragged.id, { column: 5, row: 1 }, { column: 5, row: 1 });
  assert.ok(target);
  assert.equal(target.kind, "bump");
  const inserted = placed(target.cards, dragged.id);
  assert.deepEqual({ column: inserted?.column, row: inserted?.row }, { column: 5, row: 1 });
  assert.equal(at(target.cards, 2)?.column, 1);
  const overflow = [at(target.cards, 3), at(target.cards, 4)];
  assert.ok(overflow.every((item) => item && item.row >= 2));
  normalizeLayout({ version: 1, cards: target.cards });
});

test("overflow that lands on a Card below cascades that Card downward", () => {
  const dragged = card(1, 1, 8, 6);
  const a = card(2, 1, 1, 4);
  const b = card(3, 5, 1, 4);
  const c = card(4, 9, 1, 4);
  const below = card(5, 1, 2, 6);
  const target = resolveMoveTarget([dragged, a, b, c, below], dragged.id, { column: 5, row: 1 }, { column: 5, row: 1 });
  assert.ok(target);
  assert.equal(target.kind, "bump");
  assert.ok((at(target.cards, 5)?.row ?? 0) > 2 || (at(target.cards, 3)?.row ?? 0) > 1);
  assert.ok((at(target.cards, 5)?.row ?? 0) >= 2);
  normalizeLayout({ version: 1, cards: target.cards });
});

test("a bump that would pass row 48 is illegal", () => {
  const dragged = card(1, 1, 1, 6);
  const blocker = card(2, 1, 48, 12);
  const right = card(3, 7, 47, 6);
  const target = resolveMoveTarget([dragged, blocker, right], dragged.id, { column: 7, row: 47 }, { column: 7, row: 47 });
  assert.equal(target, null);
});

test("reflow packs other Cards up and left and leaves the dropped Card in place", () => {
  const dropped = card(1, 7, 3, 4);
  const aboveHole = card(2, 1, 1, 4);
  const below = card(3, 1, 4, 4);
  const result = reflowAfterDrop([dropped, aboveHole, below], dropped.id);
  assert.deepEqual(placed(result, dropped.id), dropped);
  assert.deepEqual(at(result, 2), { ...aboveHole, column: 1, row: 1 });
  assert.deepEqual(at(result, 3), { ...below, column: 5, row: 1 });
  normalizeLayout({ version: 1, cards: result });
});

test("reflow closes the hole the dragged Card left", () => {
  const dropped = card(1, 7, 2, 4);
  const below = card(2, 1, 3, 4);
  const result = reflowAfterDrop([dropped, below], dropped.id);
  assert.deepEqual(placed(result, dropped.id), dropped);
  assert.deepEqual(at(result, 2), { ...below, column: 1, row: 1 });
  normalizeLayout({ version: 1, cards: result });
});

test("reflow never resizes a Card or moves the dropped Card", () => {
  const dropped = card(1, 5, 2, 4, 2);
  const tall = card(2, 1, 5, 3, 3);
  const result = reflowAfterDrop([dropped, tall], dropped.id);
  assert.equal(placed(result, dropped.id)?.column, 5);
  assert.equal(placed(result, dropped.id)?.row, 2);
  assert.equal(at(result, 2)?.columns, 3);
  assert.equal(at(result, 2)?.rows, 3);
  assert.ok((at(result, 2)?.row ?? 99) <= 5);
  normalizeLayout({ version: 1, cards: result });
});
