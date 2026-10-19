import assert from "node:assert/strict";
import test from "node:test";
import { abbreviateChartLabel, formatCompactCurrency, formatCompactNumber } from "../src/lib/format";

test("compact numbers use a truncated unit and keep small values exact", () => {
  assert.equal(formatCompactNumber(3567), "3.5k");
  assert.equal(formatCompactNumber(6000), "6k");
  assert.equal(formatCompactNumber(11047.33), "11k");
  assert.equal(formatCompactNumber(210.03), "210.03");
  assert.equal(formatCompactNumber(0), "0");
  assert.equal(formatCompactCurrency(3493392), "$3.4m");
  assert.equal(formatCompactCurrency(120000), "$120k");
  assert.equal(formatCompactCurrency(391813.44), "$391.8k");
  assert.equal(formatCompactCurrency(363.58), "$363.58");
  assert.equal(formatCompactCurrency(0), "$0.00");
});

test("chart labels abbreviate month names and leave other words intact", () => {
  assert.equal(abbreviateChartLabel("September"), "Sep");
  assert.equal(abbreviateChartLabel("August"), "Aug");
  assert.equal(abbreviateChartLabel("Art in the Park May 2026"), "Art in the Park May 2026");
  assert.equal(abbreviateChartLabel("General - West Jordan Youth Theatre"), "General - West Jordan Youth Theatre");
});
