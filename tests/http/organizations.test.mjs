import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  acceptInvite,
  assertError,
  assertList,
  assertMoney,
  assertOrganization,
  callApi,
  defaultEntityLabels,
  defaultPreferences,
  themeBody,
  createJson,
  grantSuperAdmin,
  label,
  logIn,
  missingId,
  remove,
  signUp,
  suite,
} from "./client.mjs";

describe("organizations", suite, () => {
  const ctx = {};

  before(async () => {
    ctx.admin = await signUp("orgadmin");
    ctx.member = await signUp("orgmember");
    ctx.outsider = await signUp("orgout");
    ctx.name = label("Organization");
    ctx.org = await createJson(ctx.admin.accessToken, "/organizations", { name: ctx.name, ignored: true });
    await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/invitations`, {
      email: ctx.member.email,
      role: "MEMBER",
    });
    await acceptInvite(ctx.member.accessToken, ctx.member.email);
  });

  test("create returns the organization and makes the caller an admin", async () => {
    assertOrganization(ctx.org, ctx.name);
    const memberships = await callApi(`/organizations/${ctx.org.id}/memberships`, { token: ctx.admin.accessToken });
    assert.equal(memberships.status, 200);
    const admin = memberships.json.items.find((item) => item.userId === ctx.admin.user.id);
    assert.equal(admin.role.code, "ADMIN");
    assert.equal(admin.rateType, "Volunteer");
    assert.equal(admin.isActive, true);
    assert.equal(admin.departmentId, null);
  });

  test("list returns only the caller's organizations unless they are a SuperAdmin", async () => {
    const other = await signUp("orgother");
    const otherOrg = await createJson(other.accessToken, "/organizations", { name: label("Other org") });
    const listed = await callApi("/organizations", { token: ctx.admin.accessToken });
    assertList(listed.json);
    assert.ok(listed.json.items.some((item) => item.id === ctx.org.id));
    assert.equal(listed.json.items.some((item) => item.id === otherOrg.id), false);
    const unauthenticated = await callApi("/organizations");
    assertError(unauthenticated, 401, "unauthorized", "Authentication is required.");
    await grantSuperAdmin(ctx.admin.user.id);
    ctx.admin = { ...ctx.admin, ...(await logIn(ctx.admin.username, ctx.admin.password)) };
    let found = false;
    for (let offset = 0; !found; offset += 100) {
      const all = await callApi("/organizations", { token: ctx.admin.accessToken, query: { limit: 100, offset } });
      assertList(all.json, { limit: 100, offset });
      assert.ok(all.json.items.length > 0, "the organization was not listed");
      found = all.json.items.some((item) => item.id === otherOrg.id);
    }
  });

  test("get requires membership", async () => {
    const response = await callApi(`/organizations/${ctx.org.id}`, { token: ctx.member.accessToken });
    assert.equal(response.status, 200);
    assert.equal(response.json.id, ctx.org.id);
    const outsider = await callApi(`/organizations/${ctx.org.id}`, { token: ctx.outsider.accessToken });
    const missing = await callApi(`/organizations/${missingId()}`, { token: ctx.admin.accessToken });
    assertError(outsider, 403, "forbidden", "Forbidden.");
    assertError(missing, 404, "not_found", "Not found.");
  });

  test("patch updates rates, labels, and theme, and members cannot patch", async () => {
    const forbidden = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.member.accessToken,
      body: { name: label("Nope") },
    });
    const empty = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {},
    });
    const rate = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { volunteerHourlyRate: 0 },
    });
    assertError(forbidden, 403, "forbidden", "Forbidden.");
    assertError(empty, 400, "validation_error", "Provide at least one field to update.");
    assertError(rate, 400, "validation_error", "volunteerHourlyRate must be greater than zero.");

    const name = label("Renamed org");
    const labels = {
      organization: "Org",
      project: "Project / Event",
      department: "Group",
      taskCategory: "Task Category",
    };
    const createdTheme = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/themes`, themeBody());
    const categoricalPalette = ["#001836", "#D4AC59", "#4EBFAE", "#FF5E9F", "#738091", "#EAD6AC"];
    const savedTheme = await callApi(`/organizations/${ctx.org.id}/themes/${createdTheme.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: themeBody({ name: createdTheme.name, categoricalPalette }),
    });
    assert.equal(savedTheme.status, 200);
    assert.deepEqual(savedTheme.json.categoricalPalette, categoricalPalette);
    const updated = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {
        name,
        volunteerHourlyRate: 40,
        rateSourceYear: 2026,
        defaultRateType: "Professional",
        themeId: createdTheme.id,
        wordmarkUrl: "https://example.com/wordmark.svg",
        wordmarkOnLightUrl: "https://example.com/wordmark-on-light.svg",
        preferences: { allowTimeEntryEditing: false, entityLabels: labels },
      },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.name, name);
    assertMoney(updated.json.volunteerHourlyRate, 40);
    assert.equal(updated.json.rateSourceYear, 2026);
    assert.equal(updated.json.defaultRateType, "Professional");
    assert.equal(updated.json.themeId, createdTheme.id);
    assert.equal(updated.json.theme.name, createdTheme.name);
    assert.equal(updated.json.wordmarkUrl, "https://example.com/wordmark.svg");
    assert.equal(updated.json.wordmarkOnLightUrl, "https://example.com/wordmark-on-light.svg");
    assert.deepEqual(updated.json.preferences, { allowTimeEntryEditing: false, entityLabels: labels });

    const globals = await callApi(`/organizations/${ctx.org.id}/themes`, { token: ctx.member.accessToken });
    assert.equal(globals.status, 200);
    assert.ok(globals.json.items.some((theme) => theme.organizationId === null && theme.name === "Clocked In"));
    const globalEdit = await callApi(`/organizations/${ctx.org.id}/themes/${globals.json.items.find((theme) => theme.organizationId === null).id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: themeBody({ name: "Nope" }),
    });
    assertError(globalEdit, 404, "not_found", "Not found.");

    const badPreference = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { preferences: { allowTimeEntryEditing: "yes" } },
    });
    assertError(badPreference, 400, "validation_error", "allowTimeEntryEditing must be a boolean.");
    const editing = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { preferences: { allowTimeEntryEditing: true } },
    });
    assert.equal(editing.status, 200);
    assert.equal(editing.json.preferences.allowTimeEntryEditing, true);
    assert.deepEqual(editing.json.preferences.entityLabels, defaultEntityLabels);
    const locked = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { preferences: { allowTimeEntryEditing: false, entityLabels: labels } },
    });
    assert.equal(locked.status, 200);
    assert.equal(locked.json.preferences.allowTimeEntryEditing, false);
    assert.deepEqual(locked.json.preferences.entityLabels, labels);

    const reset = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { defaultRateType: "Volunteer", volunteerHourlyRate: 35.47 },
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.json.defaultRateType, "Volunteer");
    assert.deepEqual(reset.json.preferences, defaultPreferences({ entityLabels: labels }));
  });

  test("delete fails while time entries remain and succeeds after they are gone", async () => {
    const org = await createJson(ctx.admin.accessToken, "/organizations", { name: label("Doomed org") });
    const category = await createJson(ctx.admin.accessToken, `/organizations/${org.id}/task-categories`, {
      name: label("Category"),
    });
    const project = await createJson(ctx.admin.accessToken, `/organizations/${org.id}/projects`, {
      title: label("Project"),
      accessType: "Public",
    });
    await createJson(ctx.admin.accessToken, "/time/duration", {
      organizationId: org.id,
      projectId: project.id,
      taskCategoryId: category.id,
      durationMinutes: 30,
      occurredOn: "2026-10-02",
    });
    const blocked = await callApi(`/organizations/${org.id}`, { method: "DELETE", token: ctx.admin.accessToken });
    assertError(blocked, 409, "conflict", "Delete the time entries first.");
    const entries = await callApi(`/users/${ctx.admin.user.id}/time-entries`, {
      token: ctx.admin.accessToken,
      query: { organizationId: org.id },
    });
    await remove(ctx.admin.accessToken, `/time-entries/${entries.json.items[0].id}`);
    await remove(ctx.admin.accessToken, `/organizations/${org.id}`);
    const missing = await callApi(`/organizations/${org.id}`, { token: ctx.admin.accessToken });
    assertError(missing, 404, "not_found", "Not found.");
  });
});
