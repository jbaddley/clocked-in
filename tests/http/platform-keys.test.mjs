import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { apiTarget } from "./fixture.mjs";
import {
  assertError,
  assertInstant,
  assertKeys,
  assertList,
  assertUuid,
  callApi,
  createJson,
  grantSuperAdmin,
  label,
  missingId,
  signUp,
  suite,
} from "./client.mjs";

const csharp = apiTarget === "csharp";

describe("platform API keys", { ...suite, skip: !csharp }, () => {
  const ctx = {};

  before(async () => {
    ctx.super = await signUp("platsuper");
    ctx.admin = await signUp("platadmin");
    ctx.other = await signUp("platother");
    await grantSuperAdmin(ctx.super.user.id);
    ctx.org = await createJson(ctx.admin.accessToken, "/organizations", { name: label("Platform key org") });
    ctx.otherOrg = await createJson(ctx.other.accessToken, "/organizations", { name: label("Other platform org") });
  });

  test("only SuperAdmins can create, list, rotate, and revoke platform keys", async () => {
    const denied = await callApi("/platform/api-keys", {
      method: "POST",
      token: ctx.admin.accessToken,
      body: { name: "Ops", scopes: ["platform:admin"] },
    });
    assertError(denied, 403, "forbidden", "Forbidden.");

    const invalid = await callApi("/platform/api-keys", {
      method: "POST",
      token: ctx.super.accessToken,
      body: { name: "Ops", scopes: ["org:admin"] },
    });
    assertError(invalid, 400, "validation_error", "scopes must be platform:admin.");

    const created = await createJson(ctx.super.accessToken, "/platform/api-keys", {
      name: "Ops",
      scopes: ["platform:admin"],
    });
    assertKeys(created, [
      "id",
      "name",
      "prefix",
      "scopes",
      "createdByUserId",
      "createdAt",
      "lastUsedAt",
      "expiresAt",
      "key",
    ]);
    assertUuid(created.id);
    assert.equal(created.organizationId, undefined);
    assert.equal(created.name, "Ops");
    assert.match(created.prefix, /^cki_test_/);
    assert.equal(created.key.startsWith(`${created.prefix}_`), true);
    assert.deepEqual(created.scopes, ["platform:admin"]);
    assert.equal(created.createdByUserId, ctx.super.user.id);
    assertInstant(created.createdAt);
    assert.equal(created.lastUsedAt, null);
    assert.equal(created.expiresAt, null);
    ctx.key = created;

    const listed = await callApi("/platform/api-keys", { token: ctx.super.accessToken });
    assert.equal(listed.status, 200);
    assertList(listed.json);
    const item = listed.json.items.find((row) => row.id === created.id);
    assert.equal(item.key, undefined);
    assert.equal(item.prefix, created.prefix);

    const rotated = await callApi(`/platform/api-keys/${created.id}/rotate`, {
      method: "POST",
      token: ctx.super.accessToken,
      body: {},
    });
    assert.equal(rotated.status, 200);
    assert.equal(rotated.json.key.startsWith(`${rotated.json.prefix}_`), true);
    assert.notEqual(rotated.json.key, created.key);
    ctx.key = rotated.json;

    const patched = await callApi(`/platform/api-keys/${created.id}`, {
      method: "PATCH",
      token: ctx.super.accessToken,
      body: { name: "Platform ops" },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.json.name, "Platform ops");
    assert.equal(patched.json.key, undefined);
  });

  test("a platform key can reach every organization and cannot mint keys", async () => {
    const own = await callApi(`/organizations/${ctx.org.id}`, { token: ctx.key.key });
    assert.equal(own.status, 200);
    assert.equal(own.json.id, ctx.org.id);

    const other = await callApi(`/organizations/${ctx.otherOrg.id}`, { apiKey: ctx.key.key });
    assert.equal(other.status, 200);
    assert.equal(other.json.id, ctx.otherOrg.id);

    const listed = await callApi("/organizations", { token: ctx.key.key });
    assert.equal(listed.status, 200);
    assertList(listed.json);

    const tag = await createJson(ctx.key.key, `/organizations/${ctx.otherOrg.id}/tags`, { name: label("Platform tag") });
    assert.equal(tag.organizationId, ctx.otherOrg.id);

    const mintPlatform = await callApi("/platform/api-keys", {
      method: "POST",
      token: ctx.key.key,
      body: { name: "Stolen", scopes: ["platform:admin"] },
    });
    assertError(mintPlatform, 403, "forbidden", "Forbidden.");

    const mintOrg = await callApi(`/organizations/${ctx.org.id}/api-keys`, {
      method: "POST",
      token: ctx.key.key,
      body: { name: "Stolen", scopes: ["org:admin"] },
    });
    assertError(mintOrg, 403, "forbidden", "Forbidden.");

    const users = await callApi("/users", { token: ctx.key.key });
    assertError(users, 403, "forbidden", "Forbidden.");

    const feedback = await callApi("/feedback", { token: ctx.key.key });
    assertError(feedback, 403, "forbidden", "Forbidden.");

    const removed = await callApi(`/organizations/${ctx.org.id}`, {
      method: "DELETE",
      token: ctx.key.key,
    });
    assertError(removed, 403, "forbidden", "Forbidden.");
  });

  test("revoked platform keys fail", async () => {
    const created = await createJson(ctx.super.accessToken, "/platform/api-keys", {
      name: "Temp",
      scopes: ["platform:admin"],
    });
    const revoked = await callApi(`/platform/api-keys/${created.id}`, {
      method: "DELETE",
      token: ctx.super.accessToken,
    });
    assert.equal(revoked.status, 204);
    const reuse = await callApi(`/organizations/${ctx.org.id}`, { token: created.key });
    assertError(reuse, 401, "unauthorized", "Authentication is required.");
    const missing = await callApi(`/platform/api-keys/${missingId()}`, {
      method: "DELETE",
      token: ctx.super.accessToken,
    });
    assertError(missing, 404, "not_found", "Not found.");
  });
});
