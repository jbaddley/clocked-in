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
  await assertPlacement(organizationId, departmentId);
  if (access.isSuperAdmin || access.canWrite(organizationId)) {
    return;
  }
  if (departmentId === null) {
    if (await access.can(organizationId, "log_event_totals")) {
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

export async function resolveHourlyRate(
  access: Access,
  userId: string,
  organizationId: string,
  hourlyRateId: string | null | undefined,
) {
  const lockToDefault = !access.isApiKey && !access.isSuperAdmin && (await access.isOrgVolunteer(organizationId));
  if (lockToDefault || !hourlyRateId) {
    return defaultVolunteerRate(organizationId);
  }

  const rate = await prisma.hourlyRate.findFirst({ where: { id: hourlyRateId, organizationId } });
  if (!rate) {
    notFound();
  }

  if (rate.isArchived) {
    validation("This hourly rate is archived.");
  }

  return { id: rate.id, rate: Number(rate.perHourRate) };
}
