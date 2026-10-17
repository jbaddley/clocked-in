import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  acceptInvite,
  assertDate,
  assertError,
  assertList,
  assertMoney,
  assertTimeEntry,
  callApi,
  createJson,
  inKind,
  label,
  missingId,
  remove,
  signUp,
  suite,
} from "./client.mjs";

describe("time entries", suite, () => {
  const ctx = {};

  before(async () => {
    ctx.admin = await signUp("timeadmin");
    ctx.member = await signUp("timemember");
    ctx.outsider = await signUp("timeout");
    ctx.departmentAdmin = await signUp("timedept");
    ctx.org = await createJson(ctx.admin.accessToken, "/organizations", { name: label("Time org") });
    ctx.department = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/departments`, {
      name: label("Time department"),
    });
    ctx.tag = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/tags`, { name: label("Time tag") });
    ctx.category = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/task-categories`, {
      name: label("Time category"),
    });
    ctx.project = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/projects`, {
      title: label("Time project"),
      accessType: "Public",
    });
    ctx.departmentProject = await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/projects`, {
      title: label("Department time project"),
      accessType: "Department",
      departmentId: ctx.department.id,
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

  test("duration and total record a snapshot of the membership rate", async () => {
    const duration = await createJson(ctx.member.accessToken, "/time/duration", {
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      durationMinutes: 90,
      occurredOn: "2026-10-01",
      description: "Committee",
      tagIds: [ctx.tag.id],
      sourceRef: label("import"),
    });
    assertTimeEntry(duration, {
      userId: ctx.member.user.id,
      enteredByUserId: ctx.member.user.id,
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      mode: "Duration",
      durationMinutes: 90,
      inKindValue: inKind(90),
    });
    assert.equal(duration.startedAt, null);
    assert.equal(duration.endedAt, null);
    assert.equal(duration.occurredOn, "2026-10-01");
    assert.equal(duration.description, "Committee");
    assert.deepEqual(duration.tagIds, [ctx.tag.id]);
    const total = await createJson(ctx.member.accessToken, "/time/total", {
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      durationMinutes: 59940,
      occurredOn: "2026-09-01",
    });
    assert.equal(total.mode, "Total");
    assert.equal(total.durationMinutes, 59940);
    assertMoney(total.inKindValue, inKind(59940));
    const tooLong = await callApi("/time/duration", {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 1441,
        occurredOn: "2026-10-02",
      },
    });
    const totalTooLong = await callApi("/time/total", {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 59941,
        occurredOn: "2026-10-02",
      },
    });
    const fromDuration = await callApi("/time/duration", {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 60,
        occurredOn: "2026-10-02",
        startedAt: "2026-10-02T15:00:00.000Z",
      },
    });
    const fromEnd = await callApi("/time/duration", {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        occurredOn: "2026-10-02",
        startedAt: "2026-10-02T15:00:00.000Z",
        endedAt: "2026-10-02T17:00:00.000Z",
      },
    });
    const startOnly = await callApi("/time/duration", {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        occurredOn: "2026-10-02",
        startedAt: "2026-10-02T15:00:00.000Z",
      },
    });
    assertError(tooLong, 400, "validation_error", "durationMinutes must be from 1 to 1440.");
    assertError(totalTooLong, 400, "validation_error", "durationMinutes must be from 1 to 59940.");
    assert.equal(fromDuration.status, 201);
    assert.equal(fromDuration.json.durationMinutes, 60);
    assert.equal(fromDuration.json.endedAt, "2026-10-02T16:00:00.000Z");
    assert.equal(fromEnd.status, 201);
    assert.equal(fromEnd.json.durationMinutes, 120);
    assert.equal(fromEnd.json.endedAt, "2026-10-02T17:00:00.000Z");
    assertError(startOnly, 400, "validation_error", "endedAt or durationMinutes is required.");
    const duplicate = await callApi(`/users/${ctx.member.user.id}/time-entries`, {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        mode: "Duration",
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 30,
        occurredOn: "2026-10-08",
        sourceRef: duration.sourceRef,
      },
    });
    assertError(duplicate, 409, "conflict");
  });

  test("list and get honor organization membership", async () => {
    const listed = await callApi(`/users/${ctx.member.user.id}/time-entries`, {
      token: ctx.admin.accessToken,
      query: { organizationId: ctx.org.id, from: "2026-10-01", to: "2026-10-01" },
    });
    assertList(listed.json);
    assert.ok(listed.json.items.every((item) => item.occurredOn === "2026-10-01"));
    assert.ok(listed.json.items.some((item) => item.mode === "Duration"));
    const entry = listed.json.items.find((item) => item.mode === "Duration");
    const fetched = await callApi(`/time-entries/${entry.id}`, { token: ctx.admin.accessToken });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.json.id, entry.id);
    const outsider = await callApi(`/users/${ctx.member.user.id}/time-entries`, { token: ctx.outsider.accessToken });
    const missing = await callApi(`/time-entries/${missingId()}`, { token: ctx.member.accessToken });
    assertError(outsider, 403, "forbidden", "Forbidden.");
    assertError(missing, 404, "not_found", "Not found.");
    const unauthenticated = await callApi("/time/duration", { method: "POST", body: {} });
    assertError(unauthenticated, 401, "unauthorized", "Authentication is required.");
  });

  test("admins can enter time for a member and members cannot enter it for someone else", async () => {
    const forbidden = await callApi(`/users/${ctx.admin.user.id}/time-entries`, {
      method: "POST",
      token: ctx.member.accessToken,
      body: {
        mode: "Total",
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 60,
        occurredOn: "2026-10-09",
      },
    });
    assertError(forbidden, 403, "forbidden", "Forbidden.");
    const created = await createJson(ctx.admin.accessToken, `/users/${ctx.member.user.id}/time-entries`, {
      mode: "Duration",
      organizationId: ctx.org.id,
      departmentId: ctx.department.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      durationMinutes: 60,
      occurredOn: "2026-10-09",
      startedAt: "2026-10-09T16:00:00.000Z",
      endedAt: "2026-10-09T17:00:00.000Z",
    });
    assertTimeEntry(created, {
      userId: ctx.member.user.id,
      enteredByUserId: ctx.admin.user.id,
      organizationId: ctx.org.id,
      departmentId: ctx.department.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      mode: "Duration",
      durationMinutes: 60,
      inKindValue: inKind(60),
    });
    const forDepartment = await createJson(
      ctx.departmentAdmin.accessToken,
      `/users/${ctx.member.user.id}/time-entries`,
      {
        mode: "Total",
        organizationId: ctx.org.id,
        departmentId: ctx.department.id,
        projectId: ctx.departmentProject.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 30,
        occurredOn: "2026-10-11",
      },
    );
    assert.equal(forDepartment.enteredByUserId, ctx.departmentAdmin.user.id);
    assert.equal(forDepartment.projectId, ctx.departmentProject.id);
    const wrongProject = await callApi(`/users/${ctx.member.user.id}/time-entries`, {
      method: "POST",
      token: ctx.admin.accessToken,
      body: {
        mode: "Total",
        organizationId: ctx.org.id,
        projectId: ctx.departmentProject.id,
        taskCategoryId: ctx.category.id,
        durationMinutes: 30,
        occurredOn: "2026-10-11",
      },
    });
    assertError(wrongProject, 400, "validation_error", "departmentId must match this department project.");
  });

  test("clock in and clock out keep a single open punch", async () => {
    const open = await createJson(ctx.admin.accessToken, "/time/clock-in", {
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      description: "Open",
      tagIds: [ctx.tag.id],
    });
    assert.equal(open.mode, "Punch");
    assert.equal(open.userId, ctx.admin.user.id);
    assert.equal(open.endedAt, null);
    assert.equal(open.durationMinutes, null);
    assert.equal(open.inKindValue, null);
    assertDate(open.occurredOn);
    assert.equal(open.occurredOn, new Date(open.startedAt).toISOString().slice(0, 10));
    const again = await callApi("/time/clock-in", {
      method: "POST",
      token: ctx.admin.accessToken,
      body: {
        organizationId: ctx.org.id,
        projectId: ctx.project.id,
        taskCategoryId: ctx.category.id,
      },
    });
    assertError(again, 409, "conflict", "You already have an open punch.");
    const closed = await callApi("/time/clock-out", {
      method: "POST",
      token: ctx.admin.accessToken,
      body: { description: "Closed", tagIds: [ctx.tag.id] },
    });
    assert.equal(closed.status, 200);
    assert.equal(closed.json.mode, "Punch");
    assert.equal(closed.json.description, "Closed");
    assert.ok(closed.json.durationMinutes >= 1);
    assertMoney(closed.json.inKindValue, inKind(closed.json.durationMinutes));
    assert.deepEqual(closed.json.tagIds, [ctx.tag.id]);
    const none = await callApi("/time/clock-out", { method: "POST", token: ctx.admin.accessToken, body: {} });
    assertError(none, 409, "conflict", "No open punch.");
    const times = await callApi(`/time-entries/${open.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { occurredOn: "2026-01-01" },
    });
    assertError(times, 400, "validation_error", "You cannot change punch times here.");
  });

  test("patch and delete a duration entry", async () => {
    const created = await createJson(ctx.member.accessToken, "/time/duration", {
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
      durationMinutes: 60,
      occurredOn: "2026-10-12",
      description: "Draft",
    });
    const blocked = await callApi(`/time-entries/${created.id}`, {
      method: "PATCH",
      token: ctx.member.accessToken,
      body: { durationMinutes: 90 },
    });
    assertError(blocked, 400, "validation_error", "Time entries cannot be edited.");
    const enabled = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { preferences: { allowTimeEntryEditing: true } },
    });
    assert.equal(enabled.status, 200);
    const updated = await callApi(`/time-entries/${created.id}`, {
      method: "PATCH",
      token: ctx.member.accessToken,
      body: { description: "Final", durationMinutes: 120, occurredOn: "2026-10-13", tagIds: [] },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.description, "Final");
    assert.equal(updated.json.durationMinutes, 120);
    assert.equal(updated.json.occurredOn, "2026-10-13");
    assertMoney(updated.json.inKindValue, inKind(120));
    assert.deepEqual(updated.json.tagIds, []);
    const outsider = await callApi(`/time-entries/${created.id}`, {
      method: "DELETE",
      token: ctx.outsider.accessToken,
    });
    assertError(outsider, 403, "forbidden", "Forbidden.");
    await remove(ctx.member.accessToken, `/time-entries/${created.id}`);
    const missing = await callApi(`/time-entries/${created.id}`, { token: ctx.member.accessToken });
    assertError(missing, 404, "not_found", "Not found.");
  });

  test("an allowed punch can change its start and end", async () => {
    const enabled = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { preferences: { allowTimeEntryEditing: true } },
    });
    assert.equal(enabled.status, 200);
    const open = await createJson(ctx.admin.accessToken, "/time/clock-in", {
      organizationId: ctx.org.id,
      projectId: ctx.project.id,
      taskCategoryId: ctx.category.id,
    });
    const updated = await callApi(`/time-entries/${open.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {
        startedAt: "2026-10-14T15:00:00.000Z",
        endedAt: "2026-10-14T16:30:00.000Z",
      },
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.startedAt, "2026-10-14T15:00:00.000Z");
    assert.equal(updated.json.endedAt, "2026-10-14T16:30:00.000Z");
    assert.equal(updated.json.durationMinutes, 90);
    assert.equal(updated.json.occurredOn, "2026-10-14");
    assertMoney(updated.json.inKindValue, inKind(90));
    const fromDuration = await callApi(`/time-entries/${open.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { durationMinutes: 30 },
    });
    assert.equal(fromDuration.status, 200);
    assert.equal(fromDuration.json.durationMinutes, 30);
    assert.equal(fromDuration.json.endedAt, "2026-10-14T15:30:00.000Z");
  });
});
