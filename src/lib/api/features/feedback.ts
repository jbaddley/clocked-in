import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { forbidden, notFound } from "@/lib/api/errors";
import {
  activeFeedbackStatuses,
  Body,
  feedbackTitle,
  isActiveFeedback,
  isCompletedFeedback,
  list,
  normalizeFeedbackArea,
  normalizeFeedbackPriority,
  normalizeFeedbackStatus,
  normalizeFeedbackType,
  optionalUuid,
  page,
  queryBool,
  requiredLongText,
  requireString,
  screenshotUrls,
  ticketUrl,
  type FeedbackArea,
  type FeedbackPriority,
  type FeedbackStatus,
  type FeedbackType,
  utcNow,
} from "@/lib/api/json";
import { createGithubIssue, syncGithubIssueState } from "@/lib/api/github-issues";
import { sendEmail } from "@/lib/api/mail";
import { appUrl } from "@/lib/api/security";
import { readPreferences } from "@/lib/api/features/organizations";
import { prisma } from "@/lib/prisma";

const personSelect = {
  id: true,
  username: true,
  email: true,
  profile: { select: { firstName: true, lastName: true, displayName: true } },
} as const;

const feedbackInclude = {
  user: { select: personSelect },
  organization: { select: { id: true, name: true, preferences: true } },
} as const;

const detailInclude = {
  ...feedbackInclude,
  actions: {
    orderBy: { updatedAt: "asc" as const },
    include: { takenBy: { select: personSelect } },
  },
};

type PersonRow = {
  id: string;
  username: string;
  email: string;
  profile: { firstName: string; lastName: string; displayName: string | null } | null;
};

type FeedbackRow = Prisma.FeedbackGetPayload<{ include: typeof feedbackInclude }> & {
  screenshotUrls: unknown;
  actions?: Prisma.FeedbackActionGetPayload<{ include: { takenBy: { select: typeof personSelect } } }>[];
};

function personJson(user: PersonRow) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName:
      user.profile?.displayName?.trim() ||
      (user.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : null) ||
      null,
  };
}

function urls(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
}

function feedbackJson(feedback: FeedbackRow, includeActions: boolean) {
  const status = feedback.status as FeedbackStatus;
  return {
    id: feedback.id,
    userId: feedback.userId,
    organizationId: feedback.organizationId,
    type: feedback.type,
    priority: feedback.priority,
    area: feedback.area,
    title: feedback.title,
    description: feedback.description,
    screenshotUrls: urls(feedback.screenshotUrls),
    status,
    active: isActiveFeedback(status),
    completed: isCompletedFeedback(status),
    githubIssueNumber: feedback.githubIssueNumber,
    ticketUrl: feedback.ticketUrl,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
    user: personJson(feedback.user),
    organization: feedback.organization ? { id: feedback.organization.id, name: feedback.organization.name } : null,
    actions: includeActions
      ? (feedback.actions ?? []).map((action) => ({
          id: action.id,
          feedbackId: action.feedbackId,
          previousStatus: action.previousStatus,
          updatedStatus: action.updatedStatus,
          updatedAt: action.updatedAt.toISOString(),
          description: action.description,
          takenByUserId: action.takenByUserId,
          ticketUrl: action.ticketUrl,
          takenBy: personJson(action.takenBy),
        }))
      : [],
  };
}

export type CreateFeedbackRequest = {
  type: FeedbackType;
  priority: FeedbackPriority;
  area: FeedbackArea;
  title: string;
  description: string;
  screenshotUrls: string[];
  organizationId: string | null;
};

export function parseCreateFeedback(body: Body): CreateFeedbackRequest {
  return {
    type: normalizeFeedbackType(requireString(body, "type")),
    priority: normalizeFeedbackPriority(requireString(body, "priority")),
    area: normalizeFeedbackArea(requireString(body, "area")),
    title: feedbackTitle(requireString(body, "title")),
    description: requiredLongText(body, "description", 4000),
    screenshotUrls: screenshotUrls(body),
    organizationId: optionalUuid(body, "organizationId"),
  };
}

export type UpdateFeedbackRequest = {
  status: FeedbackStatus;
  description: string;
  ticketUrl: string | null;
};

export function parseUpdateFeedback(body: Body): UpdateFeedbackRequest {
  return {
    status: normalizeFeedbackStatus(requireString(body, "status")),
    description: requiredLongText(body, "description", 2000),
    ticketUrl: ticketUrl(body),
  };
}

function requireSuperAdmin(access: Access) {
  if (!access.caller.isSuperAdmin) {
    forbidden();
  }
}

function firstName(user: PersonRow) {
  return user.profile?.firstName?.trim() || user.username;
}

function displayName(user: PersonRow) {
  return personJson(user).displayName || user.username;
}

function typeLabel(type: string) {
  return type === "Feature" ? "feature request" : "bug";
}

function areaLabel(area: string) {
  return area === "LogTime" ? "Log time" : area;
}

function outcome(status: FeedbackStatus) {
  if (status === "Resolved") return "we completed the work you asked for";
  if (status === "Cancelled") return "we are not going to proceed with this";
  return "we were not able to reproduce this";
}

async function trySend(to: string, template: string, variables: Record<string, string>) {
  try {
    await sendEmail(to, template, variables);
  } catch {
    // Keep the saved feedback even if a notify email fails.
  }
}

async function tryOpenGithubIssue(feedback: FeedbackRow) {
  const issue = await createGithubIssue({
    id: feedback.id,
    title: feedback.title,
    type: feedback.type as FeedbackType,
    priority: feedback.priority as FeedbackPriority,
    area: feedback.area as FeedbackArea,
    description: feedback.description,
    screenshotUrls: urls(feedback.screenshotUrls),
    submitterName: displayName(feedback.user),
    submitterUsername: feedback.user.username,
    organizationName: feedback.organization?.name ?? null,
    adminUrl: appUrl("/feedback"),
  });
  if (!issue) {
    return feedback;
  }

  try {
    return await prisma.feedback.update({
      where: { id: feedback.id },
      data: { githubIssueNumber: issue.number, ticketUrl: issue.htmlUrl },
      include: feedbackInclude,
    });
  } catch {
    return { ...feedback, githubIssueNumber: issue.number, ticketUrl: issue.htmlUrl };
  }
}

async function notifyCreated(feedback: FeedbackRow) {
  const sent = new Set<string>();
  await trySend(feedback.user.email, "feedback-received", {
    firstName: firstName(feedback.user),
    title: feedback.title,
    typeLabel: typeLabel(feedback.type),
  });
  sent.add(feedback.user.email.toLowerCase());

  const notify = {
    submitterName: displayName(feedback.user),
    typeLabel: typeLabel(feedback.type),
    priorityLabel: feedback.priority,
    areaLabel: areaLabel(feedback.area),
    title: feedback.title,
    description: feedback.description,
    url: appUrl("/feedback"),
  };
  const superAdmins = await prisma.user.findMany({ where: { isSuperAdmin: true }, select: { email: true } });
  for (const admin of superAdmins) {
    if (!sent.has(admin.email.toLowerCase())) {
      sent.add(admin.email.toLowerCase());
      await trySend(admin.email, "feedback-notify", notify);
    }
  }

  if (!feedback.organizationId || !feedback.organization) {
    return;
  }

  const notifyIds = readPreferences(feedback.organization.preferences).feedbackNotifyUserIds;
  if (notifyIds.length === 0) {
    return;
  }

  const recipients = await prisma.organizationMembership.findMany({
    where: { organizationId: feedback.organizationId, isActive: true, userId: { in: notifyIds } },
    select: { user: { select: { email: true } } },
  });
  for (const membership of recipients) {
    const email = membership.user.email;
    if (!sent.has(email.toLowerCase())) {
      sent.add(email.toLowerCase());
      await trySend(email, "feedback-notify", notify);
    }
  }
}

export async function createFeedback(access: Access, request: CreateFeedbackRequest) {
  if (request.organizationId) {
    const organization = await prisma.organization.findUnique({ where: { id: request.organizationId } });
    if (!organization) {
      notFound();
    }
  }

  const now = utcNow();
  const created = await guard(
    prisma.feedback.create({
      data: {
        userId: access.caller.id,
        organizationId: request.organizationId,
        type: request.type,
        priority: request.priority,
        area: request.area,
        title: request.title,
        description: request.description,
        screenshotUrls: request.screenshotUrls as Prisma.InputJsonValue,
        status: "Pending",
        createdAt: now,
        updatedAt: now,
      },
      include: feedbackInclude,
    }),
  );
  await notifyCreated(created);
  return feedbackJson(await tryOpenGithubIssue(created), false);
}

export async function listFeedback(access: Access, params: URLSearchParams) {
  requireSuperAdmin(access);
  const paging = page(params);
  const active = queryBool(params, "active");
  const type = params.get("type") ? normalizeFeedbackType(params.get("type") ?? "") : undefined;
  const priority = params.get("priority") ? normalizeFeedbackPriority(params.get("priority") ?? "") : undefined;
  const area = params.get("area") ? normalizeFeedbackArea(params.get("area") ?? "") : undefined;
  const status = params.get("status") ? normalizeFeedbackStatus(params.get("status") ?? "") : undefined;
  const sort = params.get("sort") ?? "createdAt";
  const descending = params.get("order") !== "asc";
  const where: Prisma.FeedbackWhereInput = {
    ...(active === true ? { status: { in: activeFeedbackStatuses } } : {}),
    ...(active === false ? { status: { notIn: activeFeedbackStatuses } } : {}),
    ...(type ? { type } : {}),
    ...(priority ? { priority } : {}),
    ...(area ? { area } : {}),
    ...(status ? { status } : {}),
  };
  const orderBy: Prisma.FeedbackOrderByWithRelationInput =
    sort === "title" || sort === "status" || sort === "priority" || sort === "type" || sort === "area"
      ? { [sort]: descending ? "desc" : "asc" }
      : { createdAt: descending ? "desc" : "asc" };
  const items = await prisma.feedback.findMany({
    where,
    include: feedbackInclude,
    orderBy,
    skip: paging.offset,
    take: paging.limit,
  });
  return list(
    items.map((item) => feedbackJson(item, false)),
    paging,
  );
}

export async function getFeedback(access: Access, feedbackId: string) {
  requireSuperAdmin(access);
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId }, include: detailInclude });
  if (!feedback) {
    notFound();
  }

  return feedbackJson(feedback, true);
}

export async function updateFeedback(access: Access, feedbackId: string, request: UpdateFeedbackRequest) {
  requireSuperAdmin(access);
  const existing = await prisma.feedback.findUnique({ where: { id: feedbackId }, include: detailInclude });
  if (!existing) {
    notFound();
  }

  const previous = existing.status as FeedbackStatus;
  const now = utcNow();
  const updated = await guard(
    prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status: request.status,
        updatedAt: now,
        ...(!existing.ticketUrl && request.ticketUrl ? { ticketUrl: request.ticketUrl } : {}),
        actions: {
          create: {
            previousStatus: previous,
            updatedStatus: request.status,
            updatedAt: now,
            description: request.description,
            takenByUserId: access.caller.id,
            ticketUrl: request.ticketUrl,
          },
        },
      },
      include: detailInclude,
    }),
  );
  if (existing.githubIssueNumber) {
    await syncGithubIssueState(existing.githubIssueNumber, request.status);
  }

  if (!isCompletedFeedback(previous) && isCompletedFeedback(request.status)) {
    await trySend(updated.user.email, "feedback-completed", {
      firstName: firstName(updated.user),
      title: updated.title,
      typeLabel: typeLabel(updated.type),
      outcome: outcome(request.status),
      note: request.description,
    });
  }

  return feedbackJson(updated, true);
}
