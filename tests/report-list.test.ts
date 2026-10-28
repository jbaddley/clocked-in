import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLayout,
  presentListRows,
  type ListReportCard,
  type ListRow,
} from "../src/lib/report-layout";

function id(slot: number) {
  return `00000000-0000-4000-8000-${slot.toString(16).padStart(12, "0")}`;
}

function row(slot: number, hours: number, extras: Partial<ListRow> = {}): ListRow {
  return {
    id: `row-${slot}`,
    label: extras.label ?? `Row ${slot}`,
    hours,
    inKind: extras.inKind ?? hours * 10,
    volunteers: extras.volunteers ?? slot,
    ...extras,
  };
}

function listCard(over: Partial<ListReportCard> = {}): ListReportCard {
  return {
    id: id(1),
    kind: "list",
    title: "By project",
    description: "",
    accessor: "user.byProject",
    column: 1,
    row: 1,
    columns: 6,
    rows: 5,
    format: "hours",
    pattern: "0,0.[00]",
    visibleColumns: ["name", "hours", "share", "inKind"],
    ...over,
  };
}

test("absent sort and limit keep API order", () => {
  const rows = [row(1, 2), row(2, 8), row(3, 5)];
  assert.deepEqual(
    presentListRows(rows, {}).map((item) => item.id),
    ["row-1", "row-2", "row-3"],
  );
});

test("limit defaults to hours desc and adds Other for the remainder", () => {
  const rows = [row(1, 2, { inKind: 20, volunteers: 1 }), row(2, 8, { inKind: 80, volunteers: 2 }), row(3, 5, { inKind: 50, volunteers: 3 })];
  const presented = presentListRows(rows, { limit: 2 });
  assert.equal(presented.length, 3);
  assert.equal(presented[0]?.id, "row-2");
  assert.equal(presented[1]?.id, "row-3");
  assert.equal(presented[2]?.id, "other");
  assert.equal(presented[2]?.label, "Other");
  assert.equal(presented[2]?.hours, 2);
  assert.equal(presented[2]?.inKind, 20);
  assert.equal(presented[2]?.volunteers, 1);
  const total = presented.reduce((sum, item) => sum + item.hours, 0);
  assert.equal(total, 15);
});

test("sort by name ascending then limit", () => {
  const rows = [row(1, 9, { label: "Zed" }), row(2, 1, { label: "Ada" }), row(3, 4, { label: "Mia" })];
  const presented = presentListRows(rows, { sortKey: "name", sortDir: "asc", limit: 1 });
  assert.equal(presented[0]?.label, "Ada");
  assert.equal(presented[1]?.label, "Other");
  assert.equal(presented[1]?.hours, 13);
});

test("saved layouts without list extras stay valid", () => {
  const layout = normalizeLayout({ version: 1, cards: [listCard()] });
  assert.equal(layout.cards[0]?.kind, "list");
  if (layout.cards[0]?.kind === "list") {
    assert.equal(layout.cards[0].sortKey, undefined);
    assert.equal(layout.cards[0].limit, undefined);
  }
});

test("list sort and limit persist through normalize", () => {
  const layout = normalizeLayout({
    version: 1,
    cards: [listCard({ sortKey: "name", sortDir: "asc", limit: 4 })],
  });
  const card = layout.cards[0];
  assert.equal(card?.kind, "list");
  if (card?.kind === "list") {
    assert.equal(card.sortKey, "name");
    assert.equal(card.sortDir, "asc");
    assert.equal(card.limit, 4);
  }
});

test("entries cards default scope and limit", () => {
  const layout = normalizeLayout({
    version: 1,
    cards: [
      {
        id: id(2),
        kind: "entries",
        title: "Recent entries",
        description: "",
        column: 1,
        row: 1,
        columns: 12,
        rows: 5,
        accessor: "entries.mine",
      },
    ],
  });
  const card = layout.cards[0];
  assert.equal(card?.kind, "entries");
  if (card?.kind === "entries") {
    assert.equal(card.scope, "mine");
    assert.equal(card.limit, 6);
    assert.equal(card.accessor, "entries.mine");
  }
});
