import assert from "node:assert/strict";
import test from "node:test";
import { formatDurationInput, minutesFromDurationInput } from "../src/lib/format";

test("HH:MM and decimal hours both become whole minutes", () => {
  assert.equal(minutesFromDurationInput("1:30"), 90);
  assert.equal(minutesFromDurationInput("01:05"), 65);
  assert.equal(minutesFromDurationInput("1:5"), 65);
  assert.equal(minutesFromDurationInput("0:01"), 1);
  assert.equal(minutesFromDurationInput("24:00"), 1440);
  assert.equal(minutesFromDurationInput("999:00"), 59940);
  assert.equal(minutesFromDurationInput(" 2:15 "), 135);
  assert.equal(minutesFromDurationInput("1.5"), 90);
  assert.equal(minutesFromDurationInput("0.25"), 15);
  assert.equal(minutesFromDurationInput("2"), 120);
  assert.equal(minutesFromDurationInput(""), null);
  assert.equal(minutesFromDurationInput("1:"), null);
  assert.equal(minutesFromDurationInput("1:60"), null);
  assert.equal(minutesFromDurationInput("1000:00"), null);
  assert.equal(minutesFromDurationInput("abc"), null);
});

test("stored minutes display as HH:MM", () => {
  assert.equal(formatDurationInput(90), "1:30");
  assert.equal(formatDurationInput(65), "1:05");
  assert.equal(formatDurationInput(1), "0:01");
  assert.equal(formatDurationInput(1440), "24:00");
  assert.equal(formatDurationInput(59940), "999:00");
  assert.equal(formatDurationInput(minutesFromDurationInput("1:30") ?? 0), "1:30");
  assert.equal(formatDurationInput(minutesFromDurationInput("1.25") ?? 0), "1:15");
});
