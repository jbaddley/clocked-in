import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { after, before, test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import {
  extractFeedbackDescription,
  extractFeedbackIdFromDescription,
  feedbackPriorityToLinear,
  formatLinearDescription,
  mapLinearPriorityToFeedbackPriority,
  mapLinearStateToFeedbackStatus,
  pickLinearStateId,
  verifyLinearWebhookSignature,
} from "../src/lib/api/linear-issues";
import { keys, syncFeedbackInCache } from "../src/lib/queries";
import type { Feedback, Paged } from "../src/lib/types";

const originalSecret = process.env.LINEAR_WEBHOOK_SECRET;

before(() => {
  process.env.LINEAR_WEBHOOK_SECRET = "unit-test-linear-webhook-secret";
});

after(() => {
  if (originalSecret === undefined) {
    delete process.env.LINEAR_WEBHOOK_SECRET;
  } else {
    process.env.LINEAR_WEBHOOK_SECRET = originalSecret;
  }
});

test("verifyLinearWebhookSignature validates HMAC-SHA256 signatures using LINEAR_WEBHOOK_SECRET", () => {
  const body = JSON.stringify({ action: "update", type: "Issue", data: { id: "issue-1" } });
  const validSig = createHmac("sha256", "unit-test-linear-webhook-secret").update(body, "utf8").digest("hex");

  assert.equal(verifyLinearWebhookSignature(body, validSig), true);
  assert.equal(verifyLinearWebhookSignature(body, `sha256=${validSig}`), true);
  assert.equal(verifyLinearWebhookSignature(body, "invalid-signature"), false);
  assert.equal(verifyLinearWebhookSignature(body, null), false);
});

test("mapLinearStateToFeedbackStatus and pickLinearStateId round-trip workflow states", () => {
  assert.equal(mapLinearStateToFeedbackStatus({ name: "Triage", type: "triage" }), "Pending");
  assert.equal(mapLinearStateToFeedbackStatus({ name: "Backlog", type: "backlog" }), "Acknowledged");
  assert.equal(mapLinearStateToFeedbackStatus({ name: "Todo", type: "unstarted" }), "Planned");
  assert.equal(mapLinearStateToFeedbackStatus({ name: "In Progress", type: "started" }), "InProgress");
  assert.equal(mapLinearStateToFeedbackStatus({ name: "Done", type: "completed" }), "Resolved");
  assert.equal(mapLinearStateToFeedbackStatus({ name: "Canceled", type: "canceled" }), "Cancelled");
  assert.equal(
    mapLinearStateToFeedbackStatus({ name: "Could not reproduce", type: "canceled" }),
    "CouldNotReproduce",
  );
  assert.equal(mapLinearStateToFeedbackStatus({ name: "Archived", type: "canceled" }), "Archived");

  const states = [
    { id: "s1", name: "Triage", type: "triage" },
    { id: "s2", name: "Backlog", type: "backlog" },
    { id: "s3", name: "Todo", type: "unstarted" },
    { id: "s4", name: "In Progress", type: "started" },
    { id: "s5", name: "Done", type: "completed" },
    { id: "s6", name: "Canceled", type: "canceled" },
  ];
  assert.equal(pickLinearStateId(states, "Pending"), "s1");
  assert.equal(pickLinearStateId(states, "Acknowledged"), "s2");
  assert.equal(pickLinearStateId(states, "Planned"), "s3");
  assert.equal(pickLinearStateId(states, "InProgress"), "s4");
  assert.equal(pickLinearStateId(states, "Resolved"), "s5");
  assert.equal(pickLinearStateId(states, "Cancelled"), "s6");
});

test("priority and description helpers preserve feedback metadata and extract clean descriptions", () => {
  assert.equal(feedbackPriorityToLinear("Urgent"), 1);
  assert.equal(feedbackPriorityToLinear("High"), 2);
  assert.equal(feedbackPriorityToLinear("Medium"), 3);
  assert.equal(feedbackPriorityToLinear("Low"), 4);

  assert.equal(mapLinearPriorityToFeedbackPriority(1), "Urgent");
  assert.equal(mapLinearPriorityToFeedbackPriority(2), "High");
  assert.equal(mapLinearPriorityToFeedbackPriority(3), "Medium");
  assert.equal(mapLinearPriorityToFeedbackPriority(4), "Low");
  assert.equal(mapLinearPriorityToFeedbackPriority(0), null);

  const feedbackId = "11111111-2222-4333-8444-555555555555";
  const formatted = formatLinearDescription({
    id: feedbackId,
    title: "Timer bug",
    type: "Bug",
    priority: "High",
    area: "LogTime",
    description: "Original description from user.\nSecond line.",
    screenshotUrls: ["https://voluntime.app/s1.png"],
    submitterName: "Ada Lovelace",
    submitterUsername: "ada",
    organizationName: "CASWJ",
    adminUrl: `https://voluntime.app/feedback/${feedbackId}`,
  });

  assert.equal(extractFeedbackIdFromDescription(formatted), feedbackId);
  assert.equal(extractFeedbackDescription(formatted), "Original description from user.\nSecond line.");
  assert.equal(extractFeedbackDescription("Plain description edited in Linear."), "Plain description edited in Linear.");
});

test("syncFeedbackInCache updates item and active/inactive list caches immediately", () => {
  const queryClient = new QueryClient();
  const baseItem: Feedback = {
    id: "11111111-2222-4333-8444-555555555555",
    userId: "user-1",
    organizationId: null,
    type: "Bug",
    priority: "High",
    area: "Dashboard",
    title: "Initial title",
    description: "Initial description",
    screenshotUrls: [],
    status: "Pending",
    ticketUrl: null,
    linearIssueId: null,
    linearIssueIdentifier: null,
    createdAt: "2026-10-30T00:00:00.000Z",
    updatedAt: "2026-10-30T00:00:00.000Z",
    user: { id: "user-1", username: "ada", email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", displayName: "Ada Lovelace" },
    organization: null,
    actions: [],
  };

  queryClient.setQueryData<Paged<Feedback>>(keys.feedback(true), { items: [baseItem], limit: 100, offset: 0 });
  queryClient.setQueryData<Paged<Feedback>>(keys.feedback(false), { items: [], limit: 100, offset: 0 });

  const resolvedItem: Feedback = {
    ...baseItem,
    title: "Updated title",
    status: "Resolved",
    actions: [
      {
        id: "act-1",
        feedbackId: baseItem.id,
        previousStatus: "Pending",
        updatedStatus: "Resolved",
        description: "Fixed",
        takenByUserId: "user-1",
        updatedAt: "2026-10-30T01:00:00.000Z",
        takenBy: baseItem.user,
      },
    ],
  };

  syncFeedbackInCache(queryClient, resolvedItem);

  assert.equal(queryClient.getQueryData<Feedback>(keys.feedbackItem(baseItem.id))?.title, "Updated title");
  assert.equal(queryClient.getQueryData<Paged<Feedback>>(keys.feedback(true))?.items.length, 0);
  assert.equal(queryClient.getQueryData<Paged<Feedback>>(keys.feedback(false))?.items[0]?.status, "Resolved");
});
