import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  acceptInvite,
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
  waitForGithubIssue,
  waitForMatchingEmails,
} from "./client.mjs";

function feedbackBody(overrides = {}) {
  return {
    type: "Bug",
    priority: "High",
    area: "LogTime",
    title: label("Timer"),
    description: "The timer did not stop when I clocked out.",
    screenshotUrls: [],
    ...overrides,
  };
}

function assertFeedback(item, expected = {}) {
  assertKeys(item, [
    "id",
    "userId",
    "organizationId",
    "type",
    "priority",
    "area",
    "title",
    "description",
    "screenshotUrls",
    "status",
    "active",
    "completed",
    "githubIssueNumber",
    "ticketUrl",
    "createdAt",
    "updatedAt",
    "user",
    "organization",
    "actions",
  ]);
  assertUuid(item.id);
  assertUuid(item.userId);
  assertInstant(item.createdAt);
  assertInstant(item.updatedAt);
  assert.equal(typeof item.active, "boolean");
  assert.equal(typeof item.completed, "boolean");
  assert.ok(Array.isArray(item.screenshotUrls));
  assert.ok(Array.isArray(item.actions));
  assertKeys(item.user, ["id", "username", "email", "displayName"]);
  if (expected.status) {
    assert.equal(item.status, expected.status);
  }
  if (expected.active !== undefined) {
    assert.equal(item.active, expected.active);
  }
  if (expected.completed !== undefined) {
    assert.equal(item.completed, expected.completed);
  }
  if (expected.title) {
    assert.equal(item.title, expected.title);
  }
  if (expected.userId) {
    assert.equal(item.userId, expected.userId);
  }
}

describe("feedback", suite, () => {
  const ctx = {};

  before(async () => {
    ctx.admin = await signUp("fbadmin");
    ctx.member = await signUp("fbmember");
    ctx.super = await signUp("fbsuper");
    ctx.notify = await signUp("fbnotify");
    await grantSuperAdmin(ctx.super.user.id);
    ctx.superNotifyCount = 0;
    ctx.org = await createJson(ctx.admin.accessToken, "/organizations", { name: label("Feedback org") });
    await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/invitations`, {
      email: ctx.member.email,
      role: "MEMBER",
    });
    await acceptInvite(ctx.member.accessToken, ctx.member.email);
    await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/invitations`, {
      email: ctx.notify.email,
      role: "MEMBER",
    });
    await acceptInvite(ctx.notify.accessToken, ctx.notify.email);
    await createJson(ctx.admin.accessToken, `/organizations/${ctx.org.id}/invitations`, {
      email: ctx.super.email,
      role: "MEMBER",
    });
    await acceptInvite(ctx.super.accessToken, ctx.super.email);
    const saved = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {
        preferences: {
          allowTimeEntryEditing: false,
          feedbackNotifyUserIds: [ctx.notify.user.id],
        },
      },
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.json.preferences.feedbackNotifyUserIds, [ctx.notify.user.id]);
  });

  test("members can create feedback and SuperAdmins can list it", async () => {
    const body = feedbackBody({ organizationId: ctx.org.id, title: label("Clock out") });
    const created = await createJson(ctx.member.accessToken, "/feedback", body);
    ctx.item = created;
    assertFeedback(created, {
      status: "Pending",
      active: true,
      completed: false,
      title: body.title,
      userId: ctx.member.user.id,
    });
    assert.equal(created.organizationId, ctx.org.id);
    assert.equal(created.organization.name, ctx.org.name);
    assert.equal(created.actions.length, 0);
    const issue = await waitForGithubIssue(body.title);
    assert.equal(created.githubIssueNumber, issue.number);
    assert.equal(created.ticketUrl, issue.html_url);
    assert.equal(issue.state, "open");
    assert.ok(issue.labels.includes("Bug"));
    ctx.githubIssue = issue;

    const memberList = await callApi("/feedback", { token: ctx.member.accessToken });
    assertError(memberList, 403, "forbidden", "Forbidden.");
    const adminList = await callApi("/feedback", { token: ctx.admin.accessToken });
    assertError(adminList, 403, "forbidden", "Forbidden.");
    const listed = await callApi("/feedback", {
      token: ctx.super.accessToken,
      query: { active: "true", limit: "100" },
    });
    assertList(listed.json, { limit: 100 });
    assert.ok(listed.json.items.some((item) => item.id === created.id));
    const detail = await callApi(`/feedback/${created.id}`, { token: ctx.super.accessToken });
    assert.equal(detail.status, 200);
    assertFeedback(detail.json, { title: body.title, status: "Pending" });
    const memberGet = await callApi(`/feedback/${created.id}`, { token: ctx.member.accessToken });
    assertError(memberGet, 403, "forbidden", "Forbidden.");
    const unauthenticated = await callApi("/feedback");
    assertError(unauthenticated, 401, "unauthorized", "Authentication is required.");
  });

  test("create emails the submitter, SuperAdmins, and the org notify list once", async () => {
    const thanks = await waitForMatchingEmails(ctx.member.email, /Thanks for your bug/i);
    assert.match(thanks.at(-1).subject, /Thanks for your bug/i);
    const notify = await waitForMatchingEmails(ctx.notify.email, /New bug:/i);
    assert.match(notify.at(-1).subject, /New bug:/i);
    const superMail = await waitForMatchingEmails(ctx.super.email, /New bug:/i);
    assert.match(superMail.at(-1).text, /Review it at/);
    ctx.superNotifyCount = superMail.length;

    const withDuplicate = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {
        preferences: {
          allowTimeEntryEditing: false,
          feedbackNotifyUserIds: [ctx.notify.user.id, ctx.super.user.id],
        },
      },
    });
    assert.equal(withDuplicate.status, 200);
    await createJson(ctx.member.accessToken, "/feedback", feedbackBody({ organizationId: ctx.org.id }));
    const afterDedup = await waitForMatchingEmails(ctx.super.email, /New bug:/i, ctx.superNotifyCount + 1);
    assert.equal(afterDedup.length, ctx.superNotifyCount + 1);
    ctx.superNotifyCount = afterDedup.length;
  });

  test("notify list rejects inactive or outsider users", async () => {
    const outsider = await signUp("fbout");
    const memberships = await callApi(`/organizations/${ctx.org.id}/memberships`, { token: ctx.admin.accessToken });
    const row = memberships.json.items.find((item) => item.userId === ctx.notify.user.id);
    const deactivated = await callApi(`/organizations/${ctx.org.id}/memberships/${row.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { isActive: false, rateType: "Volunteer" },
    });
    assert.equal(deactivated.status, 200);

    const notifyBefore = (await waitForMatchingEmails(ctx.notify.email, /New bug:/i)).length;
    await createJson(ctx.member.accessToken, "/feedback", feedbackBody({ organizationId: ctx.org.id }));
    await waitForMatchingEmails(ctx.super.email, /New bug:/i, ctx.superNotifyCount + 1);
    ctx.superNotifyCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const notifyAfter = await waitForMatchingEmails(ctx.notify.email, /New bug:/i);
    assert.equal(notifyAfter.length, notifyBefore);

    const bad = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {
        preferences: {
          allowTimeEntryEditing: false,
          feedbackNotifyUserIds: [outsider.user.id],
        },
      },
    });
    assertError(bad, 400, "validation_error", "feedbackNotifyUserIds must be active users in this organization.");
    const alsoInactive = await callApi(`/organizations/${ctx.org.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: {
        preferences: {
          allowTimeEntryEditing: false,
          feedbackNotifyUserIds: [ctx.notify.user.id],
        },
      },
    });
    assertError(
      alsoInactive,
      400,
      "validation_error",
      "feedbackNotifyUserIds must be active users in this organization.",
    );

    await callApi(`/organizations/${ctx.org.id}/memberships/${row.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { isActive: true, rateType: "Volunteer" },
    });
  });

  test("SuperAdmins update status, write an action, and email on completed statuses", async () => {
    const forbidden = await callApi(`/feedback/${ctx.item.id}`, {
      method: "PATCH",
      token: ctx.admin.accessToken,
      body: { status: "Resolved", description: "Shipped." },
    });
    assertError(forbidden, 403, "forbidden", "Forbidden.");
    const missing = await callApi(`/feedback/${missingId()}`, {
      method: "PATCH",
      token: ctx.super.accessToken,
      body: { status: "Resolved", description: "Missing." },
    });
    assertError(missing, 404, "not_found", "Not found.");
    const updated = await callApi(`/feedback/${ctx.item.id}`, {
      method: "PATCH",
      token: ctx.super.accessToken,
      body: { status: "Resolved", description: "This shipped.", ticketUrl: "https://linear.app/team/issue/ABC-1" },
    });
    assert.equal(updated.status, 200);
    assertFeedback(updated.json, { status: "Resolved", active: false, completed: true });
    assert.equal(updated.json.actions.length, 1);
    assert.equal(updated.json.actions[0].previousStatus, "Pending");
    assert.equal(updated.json.actions[0].updatedStatus, "Resolved");
    assert.equal(updated.json.actions[0].ticketUrl, "https://linear.app/team/issue/ABC-1");
    assert.equal(updated.json.actions[0].takenByUserId, ctx.super.user.id);
    const closed = await waitForGithubIssue(ctx.item.title);
    assert.equal(closed.number, ctx.githubIssue.number);
    assert.equal(closed.state, "closed");
    assert.equal(closed.state_reason, "completed");
    const completed = await waitForMatchingEmails(ctx.member.email, /Update on your bug/i);
    assert.match(completed.at(-1).text, /completed the work/i);
    const completedCount = completed.length;

    const archived = await createJson(ctx.member.accessToken, "/feedback", feedbackBody({ organizationId: ctx.org.id }));
    const archivedUpdate = await callApi(`/feedback/${archived.id}`, {
      method: "PATCH",
      token: ctx.super.accessToken,
      body: { status: "Archived", description: "Closing without a reply." },
    });
    assert.equal(archivedUpdate.status, 200);
    assertFeedback(archivedUpdate.json, { status: "Archived", active: false, completed: false });
    await waitForMatchingEmails(ctx.member.email, /Thanks for your bug/i, 2);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const afterArchive = await waitForMatchingEmails(ctx.member.email, /Update on your bug/i);
    assert.equal(afterArchive.length, completedCount);

    const inactive = await callApi("/feedback", {
      token: ctx.super.accessToken,
      query: { active: "false", limit: "100" },
    });
    assertList(inactive.json, { limit: 100 });
    assert.ok(inactive.json.items.some((item) => item.id === ctx.item.id));
    assert.ok(inactive.json.items.every((item) => item.active === false));
    const active = await callApi("/feedback", {
      token: ctx.super.accessToken,
      query: { active: "true", limit: "100" },
    });
    assert.ok(active.json.items.every((item) => item.active === true));
    assert.equal(active.json.items.some((item) => item.id === ctx.item.id), false);
  });
});
