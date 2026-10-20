import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, explain } from "../src/lib/api/errors";

test("keeps an ApiError message, including one wrapped as a cause", () => {
  assert.equal(explain(new ApiError(409, "conflict", "That email is already in use.")), "That email is already in use.");
  assert.equal(explain(new Error("outer", { cause: new ApiError(409, "conflict", "That username is already in use.") })), "That username is already in use.");
});

test("turns a transaction timeout into a sentence", () => {
  const error = new Error("Transaction API error: expired.");
  Object.assign(error, { code: "P2028" });
  assert.equal(explain(error), "That took too long and was cancelled. Try again.");
});

test("uses the useful line of a validation dump and hides connection strings", () => {
  const dumped = new Error(
    ["Invalid `prisma.user.create()` invocation:", "{", "  data: {}", "Unknown field `mustChangePassword` for model `User`."].join("\n"),
  );
  assert.equal(explain(dumped), "Unknown field `mustChangePassword` for model `User`.");
  assert.equal(explain(new Error("connect postgres://user:secret@db.prisma.io/postgres failed")), "Something went wrong.");
});
