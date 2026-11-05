import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { forbidden, notFound, validation } from "@/lib/api/errors";
import { volunteerConnectedTo } from "@/lib/api/features/connections";
import { defaultVolunteerRate } from "@/lib/api/features/hourly-rates";
import { prisma } from "@/lib/prisma";

export async function assertCanWriteUserEntry(
  access: Access,
  userId: string,
  organizationId: string,
  departmentId: string | null,
) {
  if (access.isApiKey) {
    if (!access.canWrite(organizationId)) {
      forbidden();
    }

    return;
  }

  if (
    access.actorUserId === userId ||
    access.isSuperAdmin ||
    (await access.isOrgAdmin(organizationId)) ||
    (departmentId !== null && (await access.isDepartmentAdmin(departmentId))) ||
    (await volunteerConnectedTo(access, organizationId, userId))
  ) {
    return;
  }

  forbidden();
}

async function assertPlacement(organizationId: string, departmentId: string | null) {
  if ((await prisma.organization.count({ where: { id: organizationId } })) === 0) {
    notFound();
  }

  if (departmentId !== null) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { organizationId: true },
    });
    if (!department) {
      notFound();
    }

    if (department.organizationId !== organizationId) {
      validation("departmentId does not belong to this organization.");
    }
  }
}

export async function assertLogTarget(
  access: Access,
  userId: string,
  organizationId: string,
  departmentId: string | null,
) {
  const pinned = await access.pinnedOrganization();
  if (pinned && pinned.id !== organizationId) {
    notFound();
  }

  await assertPlacement(organizationId, departmentId);
  if (access.isSuperAdmin) {
    return;
  }

  const member = await prisma.organizationMembership.count({ where: { userId, organizationId, isActive: true } });
  if (member === 0) {
    forbidden();
  }
}

export async function assertCollectiveWrite(access: Access, organizationId: string, departmentId: string | null) {
  const pinned = await access.pinnedOrganization();
  if (pinned && pinned.id !== organizationId) {
    notFound();
  }

  await assertPlacement(organizationId, departmentId);
  if (access.isSuperAdmin || access.canWrite(organizationId)) {
    return;
  }
  if (departmentId === null) {
    if ((await access.visibility(organizationId)).kind === "all" && await access.can(organizationId, "log_event_totals")) {
      return;
    }
    forbidden();
  }
  if (
    (await access.can(organizationId, "log_group_sessions", departmentId)) ||
    (await access.can(organizationId, "log_event_totals", departmentId)) ||
    (await access.isDepartmentAdmin(departmentId))
  ) {
    return;
  }
  forbidden();
}

export async function assertProject(
  access: Access,
  workerId: string,
  organizationId: string,
  departmentId: string | null,
  projectId: string,
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { editors: { select: { userId: true } } },
  });
  if (!project) {
    notFound();
  }

  if (project.organizationId !== organizationId) {
    validation("projectId does not belong to this organization.");
  }

  if (!project.isActive) {
    validation("This project is not active.");
  }

  if (project.accessType === "Department" && (departmentId === null || departmentId !== project.departmentId)) {
    validation("departmentId must match this department project.");
  }

  if (
    project.accessType === "Private" &&
    !access.isSuperAdmin &&
    project.ownerUserId !== workerId &&
    project.editors.every((editor) => editor.userId !== workerId) &&
    !access.canWrite(organizationId) &&
    !(await access.isOrgAdmin(organizationId))
  ) {
    forbidden();
  }
}

export async function assertTaskCategory(organizationId: string, taskCategoryId: string) {
  const category = await prisma.taskCategory.findUnique({
    where: { id: taskCategoryId },
    select: { organizationId: true },
  });
  if (!category) {
    notFound();
  }

  if (category.organizationId !== organizationId) {
    validation("taskCategoryId does not belong to this organization.");
  }
}

export async function tags(organizationId: string, tagIds: string[]) {
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) {
    return [];
  }

  const found = await prisma.tag.findMany({ where: { id: { in: unique }, organizationId }, select: { id: true } });
  if (found.length !== unique.length) {
    validation("A tag does not belong to this organization.");
  }

  return found.map((tag) => tag.id);
}

async function paidCatalogRate(organizationId: string, amount: Prisma.Decimal | null) {
  if (amount === null) {
    validation("Set a pay rate for this person before logging paid time.");
  }

  const rate = await prisma.hourlyRate.findFirst({
    where: { organizationId, type: "Paid", isArchived: false, perHourRate: amount },
    orderBy: { name: "asc" },
  });
  if (!rate) {
    validation("Add a paid hourly rate that matches this person's pay rate.");
  }

  return { id: rate.id, rate: Number(rate.perHourRate), type: "Paid" as const };
}

export async function resolveHourlyRate(
  access: Access,
  userId: string,
  organizationId: string,
  hourlyRateId: string | null | undefined,
) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { rateType: true, professionalBillingRate: true },
  });
  const paidMember = membership?.rateType === "Paid";
  const lockToDefault =
    !paidMember && !access.isApiKey && !access.isSuperAdmin && (await access.isOrgVolunteer(organizationId));
  if (paidMember && !hourlyRateId) {
    return paidCatalogRate(organizationId, membership.professionalBillingRate);
  }

  if (lockToDefault || !hourlyRateId) {
    const volunteer = await defaultVolunteerRate(organizationId);
    return { ...volunteer, type: "Volunteer" as const };
  }

  const rate = await prisma.hourlyRate.findFirst({ where: { id: hourlyRateId, organizationId } });
  if (!rate) {
    notFound();
  }

  if (rate.isArchived) {
    validation("This hourly rate is archived.");
  }

  if (paidMember && rate.type !== "Paid") {
    validation("Choose a paid hourly rate.");
  }

  return { id: rate.id, rate: Number(rate.perHourRate), type: rate.type };
}
