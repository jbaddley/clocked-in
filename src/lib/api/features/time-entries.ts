import { Prisma } from "@/generated/prisma/client";
import { Access, Account, accountInclude } from "@/lib/api/access";
import { volunteerConnectedOrganizationIds, volunteerConnectedTo } from "@/lib/api/features/connections";
import { readPreferences } from "@/lib/api/features/organizations";
import { guard, lockUser, transaction } from "@/lib/api/db";
import { conflict, forbidden, notFound, validation } from "@/lib/api/errors";
import {
  asDateOnly,
  assertDurationMinutes,
  assertTotalMinutes,
  Body,
  description,
  has,
  ids,
  inKindFromMinutes,
  list,
  localDate,
  optional,
  Optional,
  optionalDescription,
  optionalInstant,
  optionalString,
  optionalUuid,
  or,
  page,
  queryDate,
  queryUuid,
  requireDate,
  requireInstant,
  requireInt,
  requireString,
  requireUuid,
  sourceRef,
  utcNow,
  wholeMinutes,
} from "@/lib/api/json";
import {
  assertCanWriteUserEntry,
  assertLogTarget,
  assertProject,
  assertTaskCategory,
  resolveHourlyRate,
  tags as tagIdsFor,
} from "@/lib/api/features/entry-rules";
import { prisma } from "@/lib/prisma";

type Mode = "Punch" | "Duration" | "Total";

const entryInclude = { tags: { select: { tagId: true, tag: { select: { organizationId: true } } } } } as const;
type EntryRow = Prisma.UserTimeEntryGetPayload<{ include: typeof entryInclude }>;

function timeEntryJson(entry: EntryRow) {
  return {
    id: entry.id,
    userId: entry.userId,
    enteredByUserId: entry.enteredByUserId,
    organizationId: entry.organizationId,
    departmentId: entry.departmentId,
    projectId: entry.projectId,
    taskCategoryId: entry.taskCategoryId,
    hourlyRateId: entry.hourlyRateId,
    mode: entry.mode,
    startedAt: entry.startedAt?.toISOString() ?? null,
    endedAt: entry.endedAt?.toISOString() ?? null,
    durationMinutes: entry.durationMinutes,
    occurredOn: asDateOnly(entry.occurredOn),
    description: entry.description,
    hourlyRate: Number(entry.hourlyRate),
    inKindValue: entry.inKindValue === null ? null : Number(entry.inKindValue),
    createdAt: entry.createdAt.toISOString(),
    sourceRef: entry.sourceRef,
    tagIds: entry.tags.map((row) => row.tagId).sort(),
  };
}

type TimeFields = {
  durationMinutes: Optional<number>;
  occurredOn: Optional<Date>;
  startedAt: Optional<Date | null>;
  endedAt: Optional<Date | null>;
};

function parseTimeFields(body: Body): TimeFields {
  return {
    durationMinutes: optional(body, "durationMinutes", requireInt),
    occurredOn: optional(body, "occurredOn", requireDate),
    startedAt: optional(body, "startedAt", optionalInstant),
    endedAt: optional(body, "endedAt", optionalInstant),
  };
}

function anyTimes(fields: TimeFields) {
  return fields.durationMinutes.set || fields.occurredOn.set || fields.startedAt.set || fields.endedAt.set;
}

type EntryTimes = { startedAt: Date | null; endedAt: Date | null; durationMinutes: number; occurredOn: Date };
type ExistingTimes = {
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: number | null;
  occurredOn: Date;
} | null;

function durationTimes(fields: TimeFields, existing: ExistingTimes): EntryTimes {
  const occurredOn = fields.occurredOn.set ? fields.occurredOn.value : existing?.occurredOn;
  if (!occurredOn) {
    validation("occurredOn is required.");
  }

  const startedAt = or(fields.startedAt, existing?.startedAt ?? null);
  let endedAt = or(fields.endedAt, existing?.endedAt ?? null);
  const durationProvided = fields.durationMinutes.set;
  let durationMinutes = durationProvided ? fields.durationMinutes.value : existing?.durationMinutes;
  if (startedAt === null && endedAt === null) {
    if (durationMinutes == null) {
      validation("durationMinutes must be greater than zero.");
    }

    assertDurationMinutes(durationMinutes);
    return { startedAt: null, endedAt: null, durationMinutes, occurredOn };
  }

  if (!startedAt) {
    validation("startedAt is required.");
  }

  if (endedAt && !durationProvided) {
    if (endedAt <= startedAt) {
      validation("endedAt must be after startedAt.");
    }

    durationMinutes = wholeMinutes(startedAt, endedAt);
  } else if (durationProvided && !fields.endedAt.set) {
    if (durationMinutes == null) {
      validation("durationMinutes must be greater than zero.");
    }

    endedAt = new Date(startedAt.getTime() + durationMinutes * 60000);
  } else if (endedAt && durationMinutes != null) {
    if (endedAt <= startedAt) {
      validation("endedAt must be after startedAt.");
    }

    if (wholeMinutes(startedAt, endedAt) !== durationMinutes) {
      validation("durationMinutes does not match startedAt and endedAt.");
    }
  } else {
    validation("endedAt or durationMinutes is required.");
  }

  if (durationMinutes == null) {
    validation("durationMinutes must be greater than zero.");
  }

  assertDurationMinutes(durationMinutes);
  return { startedAt, endedAt, durationMinutes, occurredOn };
}

function totalTimes(fields: TimeFields, existing: ExistingTimes): EntryTimes {
  const startedAt = fields.startedAt.set ? fields.startedAt.value : (existing?.startedAt ?? null);
  const endedAt = fields.endedAt.set ? fields.endedAt.value : (existing?.endedAt ?? null);
  const durationMinutes = fields.durationMinutes.set ? fields.durationMinutes.value : existing?.durationMinutes;
  const occurredOn = fields.occurredOn.set ? fields.occurredOn.value : existing?.occurredOn;
  if (durationMinutes === undefined || durationMinutes === null) {
    validation("durationMinutes must be greater than zero.");
  }

  assertTotalMinutes(durationMinutes);
  if (!occurredOn) {
    validation("occurredOn is required.");
  }

  return { startedAt, endedAt, durationMinutes, occurredOn };
}

type PunchFields = {
  startedAt: Date | null;
  endedAt: Date | null;
  durationMinutes: Optional<number | null>;
  occurredOn: Date | null;
};

function parsePunchFields(body: Body): PunchFields {
  return {
    startedAt: has(body, "startedAt") ? requireInstant(body, "startedAt") : null,
    endedAt: optionalInstant(body, "endedAt"),
    durationMinutes: optional(body, "durationMinutes", (b, k) => (b[k] === null ? null : requireInt(b, k))),
    occurredOn: has(body, "occurredOn") ? requireDate(body, "occurredOn") : null,
  };
}

export type EntryPlacement = {
  organizationId: string;
  departmentId: string | null;
  projectId: string;
  taskCategoryId: string;
  description: string | null;
  tagIds: string[];
  sourceRef: string | null;
};

function parsePlacement(body: Body): EntryPlacement {
  const organizationId = requireUuid(body, "organizationId");
  const departmentId = optionalUuid(body, "departmentId");
  const projectId = requireUuid(body, "projectId");
  const taskCategoryId = requireUuid(body, "taskCategoryId");
  const entryDescription = optionalDescription(body);
  const tagIds = ids(body, "tagIds", true);
  return {
    organizationId,
    departmentId,
    projectId,
    taskCategoryId,
    description: entryDescription,
    tagIds,
    sourceRef: sourceRef(body),
  };
}

export type CreateTimeEntryRequest = {
  mode: Mode;
  placement: EntryPlacement;
  punch: PunchFields | null;
  times: EntryTimes | null;
  hourlyRateId: string | null;
};

function parseCreate(body: Body, fixedMode: Mode | null): CreateTimeEntryRequest {
  let mode = fixedMode;
  if (mode === null) {
    const value = requireString(body, "mode");
    if (value !== "Punch" && value !== "Duration" && value !== "Total") {
      validation("mode must be Punch, Duration, or Total.");
    }

    mode = value;
  }

  const placement = parsePlacement(body);
  const hourlyRateId = has(body, "hourlyRateId") ? optionalUuid(body, "hourlyRateId") : null;
  if (mode === "Punch") {
    return { mode, placement, punch: parsePunchFields(body), times: null, hourlyRateId };
  }

  const times = mode === "Duration" ? durationTimes(parseTimeFields(body), null) : totalTimes(parseTimeFields(body), null);
  return { mode, placement, punch: null, times, hourlyRateId };
}

export function parseCreateTimeEntry(body: Body) {
  return parseCreate(body, null);
}

const maxBatchDays = 31;
const dayTimeKeys = ["occurredOn", "startedAt", "endedAt", "durationMinutes"] as const;

function dayTimes(value: unknown): Body {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    validation("entries must be a list of days.");
  }

  const day = value as Body;
  const next: Body = {};
  for (const key of dayTimeKeys) {
    if (has(day, key)) {
      next[key] = day[key];
    }
  }

  return next;
}

export function parseCreateTimeEntries(body: Body): CreateTimeEntryRequest[] {
  if (!has(body, "entries") || !Array.isArray(body.entries)) {
    validation("entries must be a list of days.");
  }

  const days = body.entries;
  if (days.length < 1) {
    validation("entries must include at least one day.");
  }

  if (days.length > maxBatchDays) {
    validation("You can save up to 31 days at once.");
  }

  if (has(body, "sourceRef") && body.sourceRef != null && body.sourceRef !== "") {
    validation("sourceRef cannot be set when saving multiple days.");
  }

  const mode = requireString(body, "mode");
  if (mode !== "Duration" && mode !== "Total") {
    validation("A batch can only save duration or total time.");
  }

  const shared: Body = { ...body };
  delete shared.entries;
  for (const key of dayTimeKeys) {
    delete shared[key];
  }

  const parsed = days.map((day) => parseCreate({ ...shared, ...dayTimes(day) }, null));
  const durationMinutes = parsed[0].times!.durationMinutes;
  if (parsed.some((item) => item.times!.durationMinutes !== durationMinutes)) {
    validation("Each day must use the same duration.");
  }

  const started = parsed.filter((item) => item.times!.startedAt !== null).length;
  if (started !== 0 && started !== parsed.length) {
    validation("Each day must use the same start time.");
  }

  const ended = parsed.filter((item) => item.times!.endedAt !== null).length;
  if (ended !== 0 && ended !== parsed.length) {
    validation("Each day must use the same end time.");
  }

  const dates = parsed.map((item) => asDateOnly(item.times!.occurredOn));
  if (new Set(dates).size !== dates.length) {
    validation("Each day can only be saved once.");
  }

  return parsed;
}

export function parseLogDuration(body: Body) {
  return parseCreate(body, "Duration");
}

export function parseLogTotal(body: Body) {
  return parseCreate(body, "Total");
}

export function parseClockIn(body: Body) {
  return {
    placement: parsePlacement(body),
    hourlyRateId: has(body, "hourlyRateId") ? optionalUuid(body, "hourlyRateId") : null,
    userId: has(body, "userId") ? optionalUuid(body, "userId") : null,
  };
}

export type ClockOutRequest = { description: Optional<string | null>; tagIds: Optional<string[]>; userId: string | null };

export function parseClockOut(body: Body): ClockOutRequest {
  return {
    description: optional(body, "description", (b, k) => description(optionalString(b, k))),
    tagIds: optional(body, "tagIds", (b, k) => ids(b, k, false)),
    userId: has(body, "userId") ? optionalUuid(body, "userId") : null,
  };
}

export type UpdateTimeEntryRequest = {
  organizationId: Optional<string>;
  departmentId: Optional<string | null>;
  projectId: Optional<string>;
  taskCategoryId: Optional<string>;
  hourlyRateId: Optional<string | null>;
  description: Optional<string | null>;
  tagIds: Optional<string[]>;
  times: TimeFields;
};

export function parseUpdateTimeEntry(body: Body): UpdateTimeEntryRequest {
  return {
    organizationId: optional(body, "organizationId", requireUuid),
    departmentId: optional(body, "departmentId", optionalUuid),
    projectId: optional(body, "projectId", requireUuid),
    taskCategoryId: optional(body, "taskCategoryId", requireUuid),
    hourlyRateId: optional(body, "hourlyRateId", optionalUuid),
    description: optional(body, "description", (b, k) => description(optionalString(b, k))),
    tagIds: optional(body, "tagIds", (b, k) => ids(b, k, false)),
    times: parseTimeFields(body),
  };
}

function timeZoneOf(user: Account) {
  return user.profile?.timezone?.trim() ? user.profile.timezone : "UTC";
}

async function hasOpenPunch(tx: Prisma.TransactionClient, userId: string) {
  return (await tx.userTimeEntry.count({ where: { userId, mode: "Punch", endedAt: null } })) > 0;
}

function punchTimes(user: Account, startedAt: Date, punch: PunchFields) {
  const occurredOn = localDate(startedAt, timeZoneOf(user));
  if (punch.occurredOn && asDateOnly(punch.occurredOn) !== asDateOnly(occurredOn)) {
    validation("occurredOn must be the local date of startedAt.");
  }

  const suppliedDuration = or(punch.durationMinutes, null);
  if (!punch.endedAt) {
    if (suppliedDuration !== null) {
      validation("durationMinutes must be empty while a punch is open.");
    }

    return { startedAt, endedAt: null, durationMinutes: null, occurredOn };
  }

  const endedAt = punch.endedAt;
  if (endedAt <= startedAt) {
    validation("endedAt must be after startedAt.");
  }

  const durationMinutes = wholeMinutes(startedAt, endedAt);
  if (durationMinutes < 1) {
    validation("durationMinutes must be from 1 to 1440.");
  }

  assertDurationMinutes(durationMinutes);
  if (suppliedDuration !== null && suppliedDuration !== durationMinutes) {
    validation("durationMinutes does not match startedAt and endedAt.");
  }

  return { startedAt, endedAt, durationMinutes, occurredOn };
}

function editedPunchTimes(user: Account, existing: NonNullable<ExistingTimes>, fields: TimeFields) {
  const startedAt = fields.startedAt.set ? fields.startedAt.value : existing.startedAt;
  if (!startedAt) {
    validation("startedAt is required.");
  }

  let endedAt = fields.endedAt.set ? fields.endedAt.value : existing.endedAt;
  const durationProvided = fields.durationMinutes.set;
  let durationMinutes = durationProvided ? fields.durationMinutes.value : existing.durationMinutes;
  const occurredOn = localDate(startedAt, timeZoneOf(user));
  if (fields.occurredOn.set && asDateOnly(fields.occurredOn.value) !== asDateOnly(occurredOn)) {
    validation("occurredOn must be the local date of startedAt.");
  }

  if (!endedAt && !durationProvided) {
    return { startedAt, endedAt: null, durationMinutes: null, occurredOn };
  }

  if (endedAt && !durationProvided) {
    if (endedAt <= startedAt) {
      validation("endedAt must be after startedAt.");
    }

    durationMinutes = wholeMinutes(startedAt, endedAt);
  } else if (durationProvided && !fields.endedAt.set) {
    if (durationMinutes == null) {
      validation("durationMinutes must be greater than zero.");
    }

    endedAt = new Date(startedAt.getTime() + durationMinutes * 60000);
  } else if (endedAt && durationMinutes != null) {
    if (endedAt <= startedAt) {
      validation("endedAt must be after startedAt.");
    }

    if (wholeMinutes(startedAt, endedAt) !== durationMinutes) {
      validation("durationMinutes does not match startedAt and endedAt.");
    }
  } else {
    validation("endedAt or durationMinutes is required.");
  }

  if (durationMinutes == null || durationMinutes < 1) {
    validation("durationMinutes must be from 1 to 1440.");
  }

  assertDurationMinutes(durationMinutes);
  return { startedAt, endedAt, durationMinutes, occurredOn };
}

async function timeEditingAllowed(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { preferences: true },
  });
  return readPreferences(organization?.preferences).allowTimeEntryEditing;
}

async function assertPlacementRules(access: Access, userId: string, placement: EntryPlacement) {
  await assertCanWriteUserEntry(access, userId, placement.organizationId, placement.departmentId);
  await assertLogTarget(access, userId, placement.organizationId, placement.departmentId);
  await assertProject(access, userId, placement.organizationId, placement.departmentId, placement.projectId);
  await assertTaskCategory(placement.organizationId, placement.taskCategoryId);
  return tagIdsFor(placement.organizationId, placement.tagIds);
}

function newEntry(
  access: Access,
  userId: string,
  placement: EntryPlacement,
  mode: Mode,
  hourlyRateId: string,
  hourlyRate: number,
  tagIds: string[],
) {
  return {
    userId,
    enteredByUserId: access.actorUserId,
    organizationId: placement.organizationId,
    departmentId: placement.departmentId,
    projectId: placement.projectId,
    taskCategoryId: placement.taskCategoryId,
    hourlyRateId,
    mode,
    description: placement.description,
    hourlyRate,
    sourceRef: placement.sourceRef,
    tags: { create: tagIds.map((tagId) => ({ tagId })) },
  };
}

async function owned(access: Access, entryId: string, write: boolean) {
  const entry = await prisma.userTimeEntry.findUnique({ where: { id: entryId }, include: entryInclude });
  if (!entry) {
    notFound();
  }

  if (access.isApiKey) {
    await access.requireOrganization(entry.organizationId, write);
    return entry;
  }

  if (
    entry.userId === access.actorUserId ||
    entry.enteredByUserId === access.actorUserId ||
    access.isSuperAdmin ||
    (await access.isOrgAdmin(entry.organizationId)) ||
    (entry.departmentId !== null && (await access.isDepartmentAdmin(entry.departmentId))) ||
    (await volunteerConnectedTo(access, entry.organizationId, entry.userId))
  ) {
    return entry;
  }

  forbidden();
}

export async function listTimeEntries(access: Access, userId: string, params: URLSearchParams) {
  const paging = page(params);
  const organizationId = queryUuid(params, "organizationId");
  const departmentId = queryUuid(params, "departmentId");
  const from = queryDate(params, "from");
  const to = queryDate(params, "to");
  let visible: string[] | null = null;
  if (access.isApiKey) {
    visible = await access.activeOrganizationIds();
  } else if (access.actorUserId !== userId && !access.isSuperAdmin) {
    const shared = new Set(await access.sharedOrganizationIds(userId));
    const readable = new Set(await access.organizationsWhereCallerCanReadOthers());
    const connected = new Set(await volunteerConnectedOrganizationIds(access, userId));
    visible = [...shared].filter((organizationId) => readable.has(organizationId) || connected.has(organizationId));
    if (visible.length === 0) {
      forbidden();
    }
  }

  if ((await prisma.user.count({ where: { id: userId } })) === 0) {
    notFound();
  }

  if (visible !== null && organizationId !== undefined && !visible.includes(organizationId)) {
    forbidden();
  }

  const where: Prisma.UserTimeEntryWhereInput = { userId };
  const and: Prisma.UserTimeEntryWhereInput[] = [];
  if (visible !== null) {
    and.push({ organizationId: { in: visible } });
  }

  if (organizationId !== undefined) {
    and.push({ organizationId });
  }

  if (departmentId !== undefined) {
    and.push({ departmentId });
  }

  if (from !== undefined) {
    and.push({ occurredOn: { gte: from } });
  }

  if (to !== undefined) {
    and.push({ occurredOn: { lte: to } });
  }

  const entries = await prisma.userTimeEntry.findMany({
    where: and.length > 0 ? { ...where, AND: and } : where,
    include: entryInclude,
    orderBy: [{ occurredOn: "desc" }, { startedAt: "desc" }],
    skip: paging.offset,
    take: paging.limit,
  });
  return list(entries.map(timeEntryJson), paging);
}

export async function createTimeEntry(access: Access, userId: string, request: CreateTimeEntryRequest) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: accountInclude });
  if (!user) {
    notFound();
  }

  const placement = request.placement;
  const tagIds = await assertPlacementRules(access, userId, placement);
  const resolved = await resolveHourlyRate(access, userId, placement.organizationId, request.hourlyRateId);
  const entry = await transaction(async (tx) => {
    await lockUser(tx, userId);
    const base = newEntry(access, userId, placement, request.mode, resolved.id, resolved.rate, tagIds);
    let times: { startedAt: Date | null; endedAt: Date | null; durationMinutes: number | null; occurredOn: Date };
    if (request.punch) {
      times = punchTimes(user, request.punch.startedAt ?? utcNow(), request.punch);
      if (times.endedAt === null && (await hasOpenPunch(tx, userId))) {
        conflict("You already have an open punch.");
      }
    } else {
      times = request.times!;
    }

    return tx.userTimeEntry.create({
      data: {
        ...base,
        ...times,
        inKindValue: times.durationMinutes === null ? null : inKindFromMinutes(times.durationMinutes, resolved.rate),
      },
      include: entryInclude,
    });
  });
  return timeEntryJson(entry);
}

export async function createTimeEntries(access: Access, userId: string, requests: CreateTimeEntryRequest[]) {
  if (requests.length === 0) {
    validation("entries must include at least one day.");
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    notFound();
  }

  const first = requests[0];
  const tagIds = await assertPlacementRules(access, userId, first.placement);
  const resolved = await resolveHourlyRate(access, userId, first.placement.organizationId, first.hourlyRateId);
  const created = await transaction(async (tx) => {
    await lockUser(tx, userId);
    const rows: EntryRow[] = [];
    for (const request of requests) {
      const times = request.times;
      if (!times) {
        validation("A batch can only save duration or total time.");
      }

      rows.push(
        await tx.userTimeEntry.create({
          data: {
            ...newEntry(access, userId, request.placement, request.mode, resolved.id, resolved.rate, tagIds),
            ...times,
            inKindValue: inKindFromMinutes(times.durationMinutes, resolved.rate),
          },
          include: entryInclude,
        }),
      );
    }

    return rows;
  });
  return { items: created.map(timeEntryJson) };
}

export async function getTimeEntry(access: Access, entryId: string) {
  return timeEntryJson(await owned(access, entryId, false));
}

export async function updateTimeEntry(access: Access, entryId: string, request: UpdateTimeEntryRequest) {
  const existing = await owned(access, entryId, true);
  const organizationId = or(request.organizationId, existing.organizationId);
  const departmentId = or(request.departmentId, existing.departmentId);
  const projectId = or(request.projectId, existing.projectId);
  const taskCategoryId = or(request.taskCategoryId, existing.taskCategoryId);
  await assertCanWriteUserEntry(access, existing.userId, organizationId, departmentId);
  await assertLogTarget(access, existing.userId, organizationId, departmentId);
  await assertProject(access, existing.userId, organizationId, departmentId, projectId);
  await assertTaskCategory(organizationId, taskCategoryId);
  const tagIds = request.tagIds.set ? await tagIdsFor(organizationId, request.tagIds.value) : null;
  let hourlyRate = Number(existing.hourlyRate);
  let hourlyRateId = existing.hourlyRateId;
  let inKindValue = existing.inKindValue === null ? null : Number(existing.inKindValue);
  if (organizationId !== existing.organizationId) {
    if (tagIds === null && existing.tags.some((row) => row.tag.organizationId !== organizationId)) {
      validation("A tag does not belong to this organization.");
    }
  }

  if (request.hourlyRateId.set || organizationId !== existing.organizationId) {
    const resolved = await resolveHourlyRate(
      access,
      existing.userId,
      organizationId,
      request.hourlyRateId.set
        ? request.hourlyRateId.value
        : organizationId === existing.organizationId
          ? existing.hourlyRateId
          : null,
    );
    hourlyRateId = resolved.id;
    hourlyRate = resolved.rate;
    if (existing.mode === "Punch" && existing.durationMinutes !== null) {
      inKindValue = inKindFromMinutes(existing.durationMinutes, hourlyRate);
    }
  }

  const timesRequested = anyTimes(request.times);
  if (timesRequested && !(await timeEditingAllowed(organizationId))) {
    validation(existing.mode === "Punch" ? "You cannot change punch times here." : "Time entries cannot be edited.");
  }

  let times: {
    startedAt: Date | null;
    endedAt: Date | null;
    durationMinutes: number | null;
    occurredOn: Date;
  } | null = null;
  if (existing.mode === "Punch") {
    if (timesRequested) {
      const user = await prisma.user.findUnique({ where: { id: existing.userId }, include: accountInclude });
      if (!user) {
        notFound();
      }

      const punch = editedPunchTimes(user, existing, request.times);
      if (punch.endedAt === null && existing.endedAt !== null) {
        const otherOpen =
          (await prisma.userTimeEntry.count({
            where: { userId: existing.userId, mode: "Punch", endedAt: null, NOT: { id: existing.id } },
          })) > 0;
        if (otherOpen) {
          conflict("You already have an open punch.");
        }
      }

      times = punch;
      inKindValue = punch.durationMinutes === null ? null : inKindFromMinutes(punch.durationMinutes, hourlyRate);
    }
  } else {
    const resolved = existing.mode === "Duration" ? durationTimes(request.times, existing) : totalTimes(request.times, existing);
    times = resolved;
    inKindValue = inKindFromMinutes(resolved.durationMinutes, hourlyRate);
  }

  const updated = await guard(
    prisma.userTimeEntry.update({
      where: { id: entryId },
      data: {
        organizationId,
        departmentId,
        projectId,
        taskCategoryId,
        hourlyRateId,
        description: or(request.description, existing.description),
        hourlyRate,
        inKindValue,
        ...(times ?? {}),
        tags: tagIds === null ? undefined : { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: entryInclude,
    }),
  );
  return timeEntryJson(updated);
}

export async function deleteTimeEntry(access: Access, entryId: string) {
  await owned(access, entryId, true);
  await guard(prisma.userTimeEntry.delete({ where: { id: entryId } }));
}

function punchUserId(access: Access, userId: string | null) {
  return userId ?? (access.isApiKey ? validation("userId is required.") : access.actorUserId);
}

export async function clockIn(access: Access, request: { placement: EntryPlacement; hourlyRateId: string | null; userId: string | null }) {
  const userId = punchUserId(access, request.userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, include: accountInclude });
  if (!user) {
    notFound();
  }

  const placement = request.placement;
  const tagIds = await assertPlacementRules(access, userId, placement);
  const resolved = await resolveHourlyRate(access, userId, placement.organizationId, request.hourlyRateId);
  const startedAt = utcNow();
  const entry = await transaction(async (tx) => {
    await lockUser(tx, userId);
    if (await hasOpenPunch(tx, userId)) {
      conflict("You already have an open punch.");
    }

    return tx.userTimeEntry.create({
      data: {
        ...newEntry(access, userId, placement, "Punch", resolved.id, resolved.rate, tagIds),
        startedAt,
        occurredOn: localDate(startedAt, timeZoneOf(user)),
      },
      include: entryInclude,
    });
  });
  return timeEntryJson(entry);
}

export async function clockOut(access: Access, request: ClockOutRequest) {
  const userId = punchUserId(access, request.userId);
  const entry = await transaction(async (tx) => {
    await lockUser(tx, userId);
    const open = await tx.userTimeEntry.findFirst({ where: { userId, mode: "Punch", endedAt: null } });
    if (!open?.startedAt) {
      conflict("No open punch.");
    }

    await assertCanWriteUserEntry(access, userId, open.organizationId, open.departmentId);

    const startedAt = open.startedAt;
    let endedAt = utcNow();
    if (endedAt <= startedAt) {
      endedAt = new Date(startedAt.getTime() + 1000);
    }

    let durationMinutes = wholeMinutes(startedAt, endedAt);
    if (durationMinutes < 1) {
      endedAt = new Date(startedAt.getTime() + 60000);
      durationMinutes = 1;
    }

    assertDurationMinutes(durationMinutes);
    const tagIds = request.tagIds.set ? await tagIdsFor(open.organizationId, request.tagIds.value) : null;
    return tx.userTimeEntry.update({
      where: { id: open.id },
      data: {
        endedAt,
        durationMinutes,
        inKindValue: inKindFromMinutes(durationMinutes, Number(open.hourlyRate)),
        description: or(request.description, open.description),
        tags: tagIds === null ? undefined : { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: entryInclude,
    });
  });
  return timeEntryJson(entry);
}
