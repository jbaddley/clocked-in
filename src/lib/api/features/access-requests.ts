import { randomUUID } from "node:crypto";
import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { conflict, forbidden, notFound, validation } from "@/lib/api/errors";
import { Body, has, list, normalizeEmail, page, requireString } from "@/lib/api/json";
import { sendEmail } from "@/lib/api/mail";
import { resolveRole, roleId } from "@/lib/api/features/memberships";
import { prisma } from "@/lib/prisma";

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function requestJson(row: {
  id: string;
  organizationId: string;
  userId: string | null;
  guestId: string | null;
  requestedRoleId: string | null;
  requestedDepartmentIds: unknown;
  message: string | null;
  status: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  volunteerNeedId: string | null;
  createdAt: Date;
  user?: { email: string; username: string; profile?: { firstName: string; lastName: string; displayName: string | null } | null } | null;
  guest?: { name: string; email: string } | null;
  requestedRole?: { code: string; name: string } | null;
}) {
  const profile = row.user?.profile;
  const name =
    row.guest?.name ||
    profile?.displayName ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    row.user?.username ||
    row.user?.email ||
    row.guest?.email ||
    "Unknown";
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    guestId: row.guestId,
    email: row.user?.email ?? row.guest?.email ?? "",
    name,
    requestedRoleId: row.requestedRoleId,
    requestedRole: row.requestedRole
      ? { code: row.requestedRole.code, name: row.requestedRole.name }
      : asStringArray(row.requestedDepartmentIds).length > 0
        ? { code: "GROUP_MANAGER", name: "Group manager" }
        : null,
    requestedDepartmentIds: asStringArray(row.requestedDepartmentIds),
    message: row.message,
    status: row.status,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    volunteerNeedId: row.volunteerNeedId,
    createdAt: row.createdAt.toISOString(),
  };
}

const requestInclude = {
  user: { select: { email: true, username: true, profile: { select: { firstName: true, lastName: true, displayName: true } } } },
  guest: { select: { name: true, email: true } },
  requestedRole: { select: { code: true, name: true } },
} as const;

export function parseCreateAccessRequest(body: Body) {
  return {
    message: has(body, "message") ? requireString(body, "message").trim().slice(0, 2000) : null,
    requestedRole: has(body, "requestedRole") ? requireString(body, "requestedRole") : "GROUP_MANAGER",
    requestedDepartmentIds: asStringArray(body.requestedDepartmentIds),
    email: has(body, "email") ? normalizeEmail(requireString(body, "email")) : null,
    name: has(body, "name") ? requireString(body, "name").trim() : null,
    volunteerNeedId: has(body, "volunteerNeedId") ? requireString(body, "volunteerNeedId") : null,
    guestId: has(body, "guestId") ? requireString(body, "guestId") : null,
  };
}

export async function listAccessRequests(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requirePermission(organizationId, "approve_access_requests");
  const status = params.get("status")?.trim();
  const rows = await prisma.accessRequest.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    include: requestInclude,
    orderBy: { createdAt: "desc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(rows.map(requestJson), paging);
}

export async function createAccessRequest(
  access: Access,
  organizationId: string,
  request: ReturnType<typeof parseCreateAccessRequest>,
) {
  await access.requireOrganization(organizationId, false);
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } });
  const role =
    request.requestedRole === "GROUP_MANAGER" ? null : await resolveRole(request.requestedRole, organizationId);
  const existing = await prisma.accessRequest.findFirst({
    where: { organizationId, userId: access.actorUserId, status: "pending" },
  });
  if (existing) {
    conflict("You already have a pending access request.");
  }
  const created = await guard(
    prisma.accessRequest.create({
      data: {
        id: randomUUID(),
        organizationId,
        userId: access.actorUserId,
        requestedRoleId: role?.id ?? null,
        requestedDepartmentIds: request.requestedDepartmentIds,
        message: request.message,
        volunteerNeedId: request.volunteerNeedId,
      },
      include: requestInclude,
    }),
  );
  await notifyAdmins(organizationId, organization.name, created.user?.email ?? access.caller.email);
  return requestJson(created);
}

export async function createPublicAccessRequest(
  organizationId: string,
  input: {
    email: string;
    name: string;
    guestId?: string | null;
    volunteerNeedId?: string | null;
    message?: string | null;
  },
) {
  const existing = await prisma.accessRequest.findFirst({
    where: {
      organizationId,
      status: "pending",
      OR: [{ guestId: input.guestId ?? undefined }, { guest: { email: input.email } }],
    },
  });
  if (existing) return requestJson(existing);
  const volunteerRole = await roleId("VOLUNTEER");
  const created = await prisma.accessRequest.create({
    data: {
      id: randomUUID(),
      organizationId,
      guestId: input.guestId ?? null,
      requestedRoleId: volunteerRole,
      requestedDepartmentIds: [],
      message: input.message ?? `Requested access while signing up for a need.`,
      volunteerNeedId: input.volunteerNeedId ?? null,
    },
    include: requestInclude,
  });
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  await notifyAdmins(organizationId, organization?.name ?? "VolunTime", input.email);
  return requestJson(created);
}

export async function decideAccessRequest(
  access: Access,
  organizationId: string,
  requestId: string,
  status: "approved" | "declined",
) {
  await access.requirePermission(organizationId, "approve_access_requests");
  const row = await prisma.accessRequest.findFirst({
    where: { id: requestId, organizationId },
    include: { ...requestInclude, organization: { select: { name: true } } },
  });
  if (!row) notFound();
  if (row.status !== "pending") {
    conflict("This request has already been reviewed.");
  }
  if (status === "approved") {
    await approve(access, row);
  }
  const updated = await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status, reviewedByUserId: access.actorUserId, reviewedAt: new Date() },
    include: requestInclude,
  });
  const email = updated.user?.email ?? updated.guest?.email;
  if (email) {
    await sendEmail({
      to: email,
      organizationId: row.organizationId,
      for: "AccessRequestDecided",
      context: {
        organization: { name: row.organization.name },
        request: { decision: status === "approved" ? "approved" : "declined" },
        user: { name: updated.user?.profile?.firstName || updated.guest?.name || "there" },
      },
    });
  }
  return requestJson(updated);
}

async function approve(
  access: Access,
  row: {
    userId: string | null;
    organizationId: string;
    requestedRoleId: string | null;
    requestedDepartmentIds: unknown;
    requestedRole?: { code: string; name: string } | null;
  },
) {
  if (!row.userId) {
    return;
  }
  if (row.requestedRoleId) {
    await prisma.organizationMembership.updateMany({
      where: { userId: row.userId, organizationId: row.organizationId },
      data: { roleId: row.requestedRoleId },
    });
  }
  const departmentIds = asStringArray(row.requestedDepartmentIds);
  const adminRole = await roleId("ADMIN");
  for (const departmentId of departmentIds) {
    await prisma.departmentMembership.upsert({
      where: { userId_departmentId: { userId: row.userId, departmentId } },
      update: { roleId: adminRole },
      create: { userId: row.userId, departmentId, roleId: adminRole },
    });
  }
  void access;
}

async function notifyAdmins(organizationId: string, organizationName: string, requesterEmail: string) {
  const admins = await prisma.organizationMembership.findMany({
    where: { organizationId, isActive: true, role: { code: "ADMIN" } },
    include: { user: { select: { email: true } } },
  });
  await Promise.all(
    admins.map((admin) =>
      sendEmail({
        to: admin.user.email,
        organizationId,
        for: "AccessRequestReceived",
        context: { organization: { name: organizationName }, request: { requesterEmail } },
      }).catch(() => undefined),
    ),
  );
}

export function parseDecideAccessRequest(body: Body) {
  const status = requireString(body, "status");
  if (status !== "approved" && status !== "declined") {
    validation("status must be approved or declined.");
  }
  return { status: status as "approved" | "declined" };
}

export { forbidden };
