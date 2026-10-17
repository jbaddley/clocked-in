import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  acceptInvite,
  assertError,
  assertList,
  assertNamed,
  callApi,
  createJson,
  label,
  missingId,
  remove,
  signUp,
  suite,
} from "./client.mjs";

describe("departments", suite, () => {
  const ctx = {};

  before(async () => {
    ctx.admin = await signUp("deptadmin");
    ctx.member = await signUp("deptmember");
    ctx.outsider = await signUp("deptout");
    ctx.org = await createJson(ctx.admin.accessToken, "/organizations", { name: label("Dept org") });
    await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/invitations`, {
      email: ctx.member.email,
      role: "MEMBER",
    });
    await acceptInvite(ctx.member.accessToken, ctx.member.email);
    ctx.name = label("Department");
    ctx.department = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/departments`, {
      name: ctx.name,
    });
  });

  test("create and list departments for the organization", async () => {
    assertNamed(ctx.department, { organizationId: ctx.org.id, name: ctx.name });
    const listed = await callApi(`/organizations/${ctx.org.id}/departments`, { token: ctx.member.accessToken });
    assertList(listed.json);
    assert.ok(listed.json.items.some((item) => item.id === ctx.department.id));
    const unauthenticated = await callApi(`/organizations/${ctx.org.id}/departments`);
    assertError(unauthenticated, 401, "unauthorized", "Authentication is required.");
  });

  test("get requires organization membership", async () => {
    const response = await callApi(`/departments/${ctx.department.id}`, { token: ctx.member.accessToken });
    assert.equal(response.status, 200);
    assertNamed(response.json, { organizationId: ctx.org.id, name: ctx.name });
    const outsider = await callApi(`/departments/${ctx.department.id}`, { token: ctx.outsider.accessToken });
    const missing = await callApi(`/departments/${missingId()}`, { token: ctx.admin.accessToken });
    assertError(outsider, 403, "forbidden", "Forbidden.");
    assertError(missing, 404, "not_found", "Not found.");
  });

  test("patch and create require an organization admin", async () => {
    const forbidden = await callApi(`/organizations/${ctx.org.id}/departments`, {
      method: "POST",
      token: ctx.member.accessToken,
      body: { name: label("Nope") },
    });
    const blank = await callApi(`/organizations/${ctx.org.id}/departments`, {
      method: "POST",
      token: ctx.admin.accessToken,
      body: { name: "   " },
    });
    assertError(forbidden, 403, "forbidden", "Forbidden.");
    assertError(blank, 400, "validation_error", "name is required.");
    const renamed = label("Renamed department");
    const updated = await callApi(`/departments/${ctx.department.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { name: renamed },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.name, renamed);
    const duplicate = await callApi(`/organizations/${ctx.org.id}/departments`, {
      method: "POST",
      token: ctx.admin.accessToken,
      body: { name: renamed.toUpperCase() },
    });
    assertError(duplicate, 409, "conflict", "That value is already in use.");
  });

  test("delete fails while time entries remain", async () => {
    const department = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/departments`, {
      name: label("Busy department"),
    });
    const category = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/task-categories`, {
      name: label("Category"),
    });
    const project = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/projects`, {
      title: label("Project"),
      accessType: "Public",
    });
    await createJson(ctx.admin.accessToken, "/time/duration", {
      organizationId: ctx.org.id,
      departmentId: department.id,
      projectId: project.id,
      taskCategoryId: category.id,
      durationMinutes: 15,
      occurredOn: "2026-10-03",
    });
    const blocked = await callApi(`/departments/${department.id}`, {
      method: "DELETE",
      token: ctx.admin.accessToken,
    });
    assertError(blocked, 409, "conflict", "Delete the time entries first.");
    const spare = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/departments`, {
      name: label("Spare department"),
    });
    await remove(ctx.admin.accessToken, `/departments/${spare.id}`);
    const missing = await callApi(`/departments/${spare.id}`, { token: ctx.admin.accessToken });
    assertError(missing, 404, "not_found", "Not found.");
  });
});
