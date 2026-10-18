import assert from "node:assert/strict";
import test from "node:test";
import Color from "colorjs.io";
import { sequentialPaletteFrom, sequentialPaletteSize } from "../src/lib/sequential-palette";

function lightness(hex: string) {
  const value = new Color(hex).to("oklch").oklch.l;
  return value ?? 0;
}

test("builds ten shades and keeps the seed color", () => {
  const seed = "#D4AC59";
  const palette = sequentialPaletteFrom(seed);
  assert.equal(palette.length, sequentialPaletteSize);
  assert.ok(palette.every((color) => /^#[0-9A-F]{6}$/.test(color)));
  assert.ok(palette.includes(seed));
  const levels = palette.map(lightness);
  assert.ok(levels.every((level, index) => index === 0 || level <= levels[index - 1] + 0.002));
});

test("places a light seed at the light end and steps darker", () => {
  const palette = sequentialPaletteFrom("#F4F0E6");
  assert.equal(palette[0], "#F4F0E6");
  assert.ok(lightness(palette[1]) < lightness(palette[0]));
});

test("places a dark seed at the dark end and steps lighter", () => {
  const palette = sequentialPaletteFrom("#000000");
  assert.equal(palette.at(-1), "#000000");
  assert.ok(lightness(palette[0]) > lightness(palette.at(-1)!));
});

test("places a mid seed between lighter and darker shades", () => {
  const seed = "#FF5E9F";
  const palette = sequentialPaletteFrom(seed);
  const slot = palette.indexOf(seed);
  assert.ok(slot > 0 && slot < palette.length - 1);
  assert.ok(lightness(palette[slot - 1]) > lightness(seed));
  assert.ok(lightness(palette[slot + 1]) < lightness(seed));
});
