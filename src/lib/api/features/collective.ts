import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { notFound, validation } from "@/lib/api/errors";
import {
  Body,
  collectiveInKind,
  description,
  has,
  ids,
  list,
  optional,
  Optional,
  optionalDescription,
  optionalString,
  optionalUuid,
  or,
  page,
  queryUuid,
  requireInstant,
  requireInt,
  requireUuid,
} from "@/lib/api/json";
import { assertCollectiveWrite, assertProject, assertTaskCategory, resolveHourlyRate, tags } from "@/lib/api/features/entry-rules";
import { prisma } from "@/lib/prisma";

const collectiveInclude = { tags: { select: { tagId: true } } } as const;
type CollectiveRow = Prisma.CollectiveTimeEntryGetPayload<{ include: typeof collectiveInclude }>;

function collectiveJson(entry: CollectiveRow) {
  return {
    id: entry.id,
    recordedByUserId: entry.recordedByUserId,
    organizationId: entry.organizationId,
    departmentId: entry.departmentId,
    projectId: entry.projectId,
    taskCategoryId: entry.taskCategoryId,
    hourlyRateId: entry.hourlyRateId,
    startedAt: entry.startedAt.toISOString(),
    endedAt: entry.endedAt.toISOString(),
    participantCount: entry.participantCount,
    description: entry.description,
    hourlyRate: Number(entry.hourlyRate),
    inKindValue: Number(entry.inKindValue),
    createdAt: entry.createdAt.toISOString(),
    tagIds: entry.tags.map((row) => row.tagId).sort(),
  };
}

function assertSpan(startedAt: Date, endedAt: Date, participantCount: number) {
  if (endedAt <= startedAt) {
    validation("endedAt must be after startedAt.");
  }

  if (participantCount < 1) {
    validation("participantCount must be at least 1.");
  }
}

export type CreateCollectiveRequest = {
  organizationId: string;
  departmentId: string | null;
  projectId: string;
  taskCategoryId: string;
  startedAt: Date;
  endedAt: Date;
  participantCount: number;
  description: string | null;
  tagIds: string[];
  hourlyRateId: string | null;
};

export function parseCreateCollective(body: Body): CreateCollectiveRequest {
  const organizationId = requireUuid(body, "organizationId");
  const departmentId = optionalUuid(body, "departmentId");
  const projectId = requireUuid(body, "projectId");
  const taskCategoryId = requireUuid(body, "taskCategoryId");
  const startedAt = requireInstant(body, "startedAt");
  const endedAt = requireInstant(body, "endedAt");
  const participantCount = requireInt(body, "participantCount");
  const entryDescription = optionalDescription(body);
  assertSpan(startedAt, endedAt, participantCount);
  const tagIds = ids(body, "tagIds", true);
  return {
    organizationId,
    departmentId,
    projectId,
    taskCategoryId,
    startedAt,
    endedAt,
    participantCount,
    description: entryDescription,
    tagIds,
    hourlyRateId: has(body, "hourlyRateId") ? optionalUuid(body, "hourlyRateId") : null,
  };
}

export type UpdateCollectiveRequest = {
  organizationId: Optional<string>;
  departmentId: Optional<string | null>;
  projectId: Optional<string>;
  taskCategoryId: Optional<string>;
  hourlyRateId: Optional<string | null>;
  startedAt: Optional<Date>;
  endedAt: Optional<Date>;
  participantCount: Optional<number>;
  description: Optional<string | null>;
  tagIds: Optional<string[]>;
};

export function parseUpdateCollective(body: Body): UpdateCollectiveRequest {
  return {
    organizationId: optional(body, "organizationId", requireUuid),
    departmentId: optional(body, "departmentId", optionalUuid),
    projectId: optional(body, "projectId", requireUuid),
    taskCategoryId: optional(body, "taskCategoryId", requireUuid),
    hourlyRateId: optional(body, "hourlyRateId", optionalUuid),
    startedAt: optional(body, "startedAt", requireInstant),
    endedAt: optional(body, "endedAt", requireInstant),
    participantCount: optional(body, "participantCount", requireInt),
    description: optional(body, "description", (b, k) => description(optionalString(b, k))),
    tagIds: optional(body, "tagIds", (b, k) => ids(b, k, false)),
  };
}

async function load(entryId: string) {
  const entry = await prisma.collectiveTimeEntry.findUnique({ where: { id: entryId }, include: collectiveInclude });
  if (!entry) {
    notFound();
  }

  return entry;
}

export async function listCollective(access: Access, params: URLSearchParams) {
  const paging = page(params);
  const organizationId = queryUuid(params, "organizationId");
  const departmentId = queryUuid(params, "departmentId");
  if (organizationId !== undefined) {
    await access.requireOrganization(organizationId, false);
  }

  if (departmentId !== undefined) {
    const department = await access.requireDepartment(departmentId);
    if (organizationId !== undefined && department.organizationId !== organizationId) {
      validation("departmentId does not belong to this organization.");
    }
  }

  const where: Prisma.CollectiveTimeEntryWhereInput = {};
  if (organizationId !== undefined) {
    where.organizationId = organizationId;
  } else if (!access.isSuperAdmin) {
    where.organizationId = { in: await access.activeOrganizationIds() };
  }

  if (departmentId !== undefined) {
    where.departmentId = departmentId;
  }

  const entries = await prisma.collectiveTimeEntry.findMany({
    where,
    include: collectiveInclude,
    orderBy: { startedAt: "desc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(entries.map(collectiveJson), paging);
}

export async function createCollective(access: Access, request: CreateCollectiveRequest) {
  const callerId = access.actorUserId;
  await assertCollectiveWrite(access, request.organizationId, request.departmentId);
  await assertProject(access, callerId, request.organizationId, request.departmentId, request.projectId);
  await assertTaskCategory(request.organizationId, request.taskCategoryId);
  const tagIds = await tags(request.organizationId, request.tagIds);
  const resolved = await resolveHourlyRate(access, callerId, request.organizationId, request.hourlyRateId);
  const hourlyRate = resolved.rate;
  const entry = await guard(
    prisma.collectiveTimeEntry.create({
      data: {
        recordedByUserId: callerId,
        organizationId: request.organizationId,
        departmentId: request.departmentId,
        projectId: request.projectId,
        taskCategoryId: request.taskCategoryId,
        hourlyRateId: resolved.id,
        startedAt: request.startedAt,
        endedAt: request.endedAt,
        participantCount: request.participantCount,
        description: request.description,
        hourlyRate,
        inKindValue: collectiveInKind(request.startedAt, request.endedAt, request.participantCount, hourlyRate),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: collectiveInclude,
    }),
  );
  return collectiveJson(entry);
}

export async function getCollective(access: Access, entryId: string) {
  const entry = await load(entryId);
  await access.requireOrganization(entry.organizationId, false);
  return collectiveJson(entry);
}

export async function updateCollective(access: Access, entryId: string, request: UpdateCollectiveRequest) {
  const existing = await load(entryId);
  if (request.organizationId.set && request.organizationId.value !== existing.organizationId) {
    validation("organizationId cannot change.");
  }

  const departmentId = or(request.departmentId, existing.departmentId);
  const projectId = or(request.projectId, existing.projectId);
  const taskCategoryId = or(request.taskCategoryId, existing.taskCategoryId);
  const startedAt = or(request.startedAt, existing.startedAt);
  const endedAt = or(request.endedAt, existing.endedAt);
  const participantCount = or(request.participantCount, existing.participantCount);
  assertSpan(startedAt, endedAt, participantCount);
  await assertCollectiveWrite(access, existing.organizationId, departmentId);
  await assertProject(access, access.actorUserId, existing.organizationId, departmentId, projectId);
  await assertTaskCategory(existing.organizationId, taskCategoryId);
  const tagIds = request.tagIds.set ? await tags(existing.organizationId, request.tagIds.value) : null;
  const resolved = request.hourlyRateId.set
    ? await resolveHourlyRate(access, access.actorUserId, existing.organizationId, request.hourlyRateId.value)
    : { id: existing.hourlyRateId, rate: Number(existing.hourlyRate) };
  const updated = await guard(
    prisma.collectiveTimeEntry.update({
      where: { id: entryId },
      data: {
        departmentId,
        projectId,
        taskCategoryId,
        hourlyRateId: resolved.id,
        hourlyRate: resolved.rate,
        startedAt,
        endedAt,
        participantCount,
        description: or(request.description, existing.description),
        inKindValue: collectiveInKind(startedAt, endedAt, participantCount, resolved.rate),
        tags: tagIds === null ? undefined : { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: collectiveInclude,
    }),
  );
  return collectiveJson(updated);
}

export async function deleteCollective(access: Access, entryId: string) {
  const entry = await load(entryId);
  await assertCollectiveWrite(access, entry.organizationId, entry.departmentId);
  await guard(prisma.collectiveTimeEntry.delete({ where: { id: entryId } }));
}
