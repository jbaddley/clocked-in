import assert from "node:assert/strict";
import test from "node:test";
import { clockedInTheme } from "../src/lib/brand";
import { colorsForPalette, defaultPalette, paletteForChart, seriesColor } from "../src/lib/chart-palette";

test("pie and donut charts never keep a single-color palette", () => {
  assert.equal(paletteForChart("pie", "single"), "categorical");
  assert.equal(paletteForChart("donut", "single"), "categorical");
  assert.equal(defaultPalette("pie"), "categorical");
  assert.equal(defaultPalette("donut", "sequential"), "sequential");
  assert.equal(paletteForChart("bar", "single"), "single");
  assert.equal(paletteForChart("column", "diverging"), "diverging");
  assert.equal(defaultPalette("bar"), "single");
});

test("palette colors come from the selected theme palette", () => {
  assert.deepEqual(colorsForPalette(clockedInTheme, "single"), [clockedInTheme.chartColor]);
  assert.deepEqual(colorsForPalette(clockedInTheme, "categorical"), [...clockedInTheme.categoricalPalette]);
  assert.deepEqual(colorsForPalette(clockedInTheme, "sequential"), [...clockedInTheme.sequentialPalette]);
  assert.deepEqual(colorsForPalette(clockedInTheme, "diverging"), [...clockedInTheme.divergingPalette]);
  assert.equal(seriesColor(["#111111", "#222222"], 2), "#111111");
  assert.deepEqual(colorsForPalette({ ...clockedInTheme, categoricalPalette: ["nope"] }, "categorical"), [
    clockedInTheme.chartColor,
  ]);
});
