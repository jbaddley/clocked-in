import assert from "node:assert/strict";
import test from "node:test";
import { defaultReviewAction, peopleRowMatch } from "../../src/lib/import/people-review";

test("near-match and existing email default to Skip", () => {
  assert.equal(defaultReviewAction("New"), "import");
  assert.equal(defaultReviewAction("Near match"), "skip");
  assert.equal(defaultReviewAction("Existing email"), "skip");
});

test("peopleRowMatch finds existing email and near-match names", () => {
  const members = [{ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" }];
  assert.equal(peopleRowMatch({ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" }, members), "Existing email");
  assert.equal(peopleRowMatch({ email: "other@example.com", firstName: "Ada", lastName: "Lovelace" }, members), "Near match");
  assert.equal(peopleRowMatch({ email: "new@example.com", firstName: "Grace", lastName: "Hopper" }, members), "New");
});
