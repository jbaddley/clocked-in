import assert from "node:assert/strict";
import test from "node:test";
import { nextAvailableUsername, usernameFromName } from "../src/lib/import/username";

test("usernameFromName uses first initial plus last name", () => {
  assert.equal(usernameFromName("John", "Smith"), "jsmith");
  assert.equal(usernameFromName("Ada", "Lovelace"), "alovelace");
});

test("nextAvailableUsername appends a digit when the base is taken", () => {
  const taken = new Set(["jsmith"]);
  const preview = nextAvailableUsername("jsmith", (username) => taken.has(username));
  assert.equal(preview.username, "jsmith1");
  assert.equal(preview.collided, true);
});
