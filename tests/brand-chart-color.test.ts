import assert from "node:assert/strict";
import test from "node:test";
import { brandStyle, chartColorCount, clockedInTheme } from "../src/lib/brand";

test("every chart series uses the base chart color", () => {
  const style = brandStyle({ ...clockedInTheme, chartColor: "#123456" }) as Record<string, string>;
  for (let index = 1; index <= chartColorCount; index += 1) {
    assert.equal(style[`--chart-${index}`], "#123456");
  }
});
