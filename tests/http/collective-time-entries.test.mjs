import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  acceptInvite,
  assertCollective,
  assertError,
  assertList,
  callApi,
  createJson,
  label,
  missingId,
  remove,
  signUp,
  suite,
} from "./client.mjs";

describe("collective time entries", suite, () => {
  const ctx = {};

  before(async () => {
    ctx.admin = await signUp("colladmin");
    ctx.member = await signUp("collmember");
    ctx.departmentAdmin = await signUp("colldept");
    ctx.org = await createJson(ctx.admin.accessToken, "/organizations", { name: label("Collective org") });
    ctx.department = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/departments`, {
      name: label("Collective department"),
    });
    ctx.tag = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/tags`, { name: label("Collective tag") });
    ctx.category = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/task-categories`, {
      name: label("Collective category"),
    });
    ctx.project = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/projects`, {
      title: label("Collective project"),
      accessType: "Public",
    });
    await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/invitations`, {
      email: ctx.member.email,
      role: "MEMBER",
    });
    await acceptInvite(ctx.member.accessToken, ctx.member.email);
    await createJson(ctx.admin.accessToken, `/departments/${ctx.department.id}/invitations`, {
      email: ctx.departmentAdmin.email,
      role: "ADMIN",
    });
    await acceptInvite(ctx.departmentAdmin.accessToken, ctx.departmentAdmin.email);
  });

  test("an organization admin records group time", async () => {
    const created = await createJson(ctx.admin.accessToken, "/collective-time-entries", {
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      startedAt: "2026-10-01T15:00:00.000Z",
      endedAt: "2026-10-01T17:00:00.000Z",
      participantCount: 3,
      description: "Training",
      tagIds: [ctx.tag.id],
    });
    ctx.entry = created;
    assertCollective(created, {
      recordedByUserId: ctx.admin.user.id,
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      participantCount: 3,
      inKindValue: 212.82,
    });
    assert.equal(created.description, "Training");
    assert.deepEqual(created.tagIds, [ctx.tag.id]);
    const early = await callApi("/collective-time-entries", {
      method: "POST",
      token: ctx.admin.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        startedAt: "2026-10-01T17:00:00.000Z",
        endedAt: "2026-10-01T15:00:00.000Z",
        participantCount: 1,
      },
    });
    const zero = await callApi("/collective-time-entries", {
      method: "POST",
      token: ctx.admin.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        startedAt: "2026-10-01T15:00:00.000Z",
        endedAt: "2026-10-01T16:00:00.000Z",
        participantCount: 0,
      },
    });
    assertError(early, 400, "validation_error", "endedAt must be after startedAt.");
    assertError(zero, 400, "validation_error", "participantCount must be at least 1.");
  });

  test("members can read collective time and cannot record it", async () => {
    const listed = await callApi("/collective-time-entries", {
      token: ctx.member.accessToken,
      query: { organizationId: ctx.org.id },
    });
    assertList(listed.json);
    assert.ok(listed.json.items.some((item) => item.id === ctx.entry.id));
    const fetched = await callApi(`/collective-time-entries/${ctx.entry.id}`, { token: ctx.member.accessToken });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.json.id, ctx.entry.id);
    const forbidden = await callApi("/collective-time-entries", {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        startedAt: "2026-10-02T15:00:00.000Z",
        endedAt: "2026-10-02T16:00:00.000Z",
        participantCount: 2,
      },
    });
    const missing = await callApi(`/collective-time-entries/${missingId()}`, { token: ctx.member.accessToken });
    const unauthenticated = await callApi("/collective-time-entries");
    assertError(forbidden, 403, "forbidden", "Forbidden.");
    assertError(missing, 404, "not_found", "Not found.");
    assertError(unauthenticated, 401, "unauthorized", "Authentication is required.");
  });

  test("a department admin records time only for that department", async () => {
    const organization = await callApi("/collective-time-entries", {
      method: "POST",
      token: ctx.departmentAdmin.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        startedAt: "2026-10-03T15:00:00.000Z",
        endedAt: "2026-10-03T16:00:00.000Z",
        participantCount: 2,
      },
    });
    assertError(organization, 403, "forbidden", "Forbidden.");
    const created = await createJson(ctx.departmentAdmin.accessToken, "/collective-time-entries", {
      organizationId: ctx.org.id,
      departmentId: ctx.department.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      startedAt: "2026-10-03T15:00:00.000Z",
      endedAt: "2026-10-03T16:00:00.000Z",
      participantCount: 2,
    });
    assert.equal(created.departmentId, ctx.department.id);
    assert.equal(created.recordedByUserId, ctx.departmentAdmin.user.id);
    assert.equal(created.inKindValue, 70.94);
  });

  test("patch and delete keep the organization and the writer", async () => {
    const moved = await callApi(`/collective-time-entries/${ctx.entry.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { organizationId: missingId() },
    });
    assertError(moved, 400, "validation_error", "organizationId cannot change.");
    const updated = await callApi(`/collective-time-entries/${ctx.entry.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { participantCount: 4, description: "Updated training" },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.participantCount, 4);
    assert.equal(updated.json.description, "Updated training");
    assert.equal(updated.json.inKindValue, 283.76);
    const forbidden = await callApi(`/collective-time-entries/${ctx.entry.id}`, {
      method: "DELETE",
      token: ctx.member.accessToken,
    });
    assertError(forbidden, 403, "forbidden", "Forbidden.");
    await remove(ctx.admin.accessToken, `/collective-time-entries/${ctx.entry.id}`);
    const missing = await callApi(`/collective-time-entries/${ctx.entry.id}`, { token: ctx.admin.accessToken });
    assertError(missing, 404, "not_found", "Not found.");
  });
});
