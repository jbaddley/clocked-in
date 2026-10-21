import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard, lockUser, transaction } from "@/lib/api/db";
import { ApiError, conflict, notFound, validation } from "@/lib/api/errors";
import { Body, list, normalizeEmail, normalizeRole, page, Page, requireString, RoleCode } from "@/lib/api/json";
import { sendEmail } from "@/lib/api/mail";
import {
  departmentMembershipJson,
  membershipInclude,
  orgMembershipJson,
  roleId,
  roleJson,
} from "@/lib/api/features/memberships";
import { readPreferences } from "@/lib/api/features/organizations";
import { labels } from "@/lib/labels";
import { allocateNumericCode, appUrl, hashCode, inviteMs } from "@/lib/api/security";
import { prisma } from "@/lib/prisma";

const invitationInclude = { role: true } as const;
type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>;

function invitationJson(invitation: InvitationRow) {
  return {
    id: invitation.id,
    email: invitation.email,
    organizationId: invitation.organizationId,
    departmentId: invitation.departmentId,
    role: roleJson(invitation.role),
    invitedByUserId: invitation.invitedByUserId,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export type CreateInvitationRequest = { email: string; role: RoleCode };

export function parseCreateInvitation(body: Body): CreateInvitationRequest {
  return {
    email: normalizeEmail(requireString(body, "email")),
    role: normalizeRole(requireString(body, "role")),
  };
}

export type AcceptInvitationRequest = { code: string };

export function parseAcceptInvitation(body: Body): AcceptInvitationRequest {
  return { code: requireString(body, "code") };
}

function inviteUrl(code: string) {
  return appUrl(`/accept?code=${encodeURIComponent(code)}`);
}

function mailedCode() {
  return allocateNumericCode(async (codeHash) => {
    const existing = await prisma.invitation.findUnique({ where: { codeHash }, select: { id: true } });
    return existing !== null;
  });
}

function inviteTarget(
  organization: { name: string; preferences?: Parameters<typeof readPreferences>[0] },
  departmentName?: string,
) {
  const copy = labels(readPreferences(organization.preferences));
  return departmentName
    ? { targetKind: copy.department, targetName: departmentName }
    : { targetKind: copy.organization, targetName: organization.name };
}

async function create(
  access: Access,
  organizationId: string,
  departmentId: string | null,
  target: { targetKind: string; targetName: string },
  request: CreateInvitationRequest,
) {
  const now = new Date();
  const code = await mailedCode();
  const invitation = await guard(
    prisma.invitation.create({
      data: {
        email: request.email,
        organizationId,
        departmentId,
        roleId: await roleId(request.role),
        codeHash: hashCode(code),
        invitedByUserId: access.actorUserId,
        expiresAt: new Date(now.getTime() + inviteMs),
        createdAt: now,
      },
      include: invitationInclude,
    }),
  );
  try {
    await sendEmail(request.email, "invitation", {
      targetKind: target.targetKind,
      targetName: target.targetName,
      roleName: invitation.role.name,
      code,
      url: inviteUrl(code),
    });
  } catch (error) {
    await prisma.invitation.delete({ where: { id: invitation.id } });
    throw error;
  }

  return invitationJson(invitation);
}

async function listWhere(where: Prisma.InvitationWhereInput, paging: Page) {
  const invitations = await prisma.invitation.findMany({
    where,
    include: invitationInclude,
    orderBy: { createdAt: "desc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(invitations.map(invitationJson), paging);
}

async function revoke(where: Prisma.InvitationWhereInput) {
  const invitation = await prisma.invitation.findFirst({ where, include: invitationInclude });
  if (!invitation) {
    notFound();
  }

  if (invitation.acceptedAt) {
    conflict("This invite has already been accepted.");
  }

  if (invitation.revokedAt) {
    return invitationJson(invitation);
  }

  return invitationJson(
    await guard(
      prisma.invitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
        include: invitationInclude,
      }),
    ),
  );
}

export async function createOrganizationInvitation(
  access: Access,
  organizationId: string,
  request: CreateInvitationRequest,
) {
  const organization = await access.requireOrganizationAdmin(organizationId);
  return create(access, organization.id, null, inviteTarget(organization), request);
}

export async function createDepartmentInvitation(access: Access, departmentId: string, request: CreateInvitationRequest) {
  const department = await access.requireDepartmentManager(departmentId);
  const organization = await access.requireOrganization(department.organizationId, false);
  return create(access, department.organizationId, department.id, inviteTarget(organization, department.name), request);
}

export async function listOrganizationInvitations(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganizationAdmin(organizationId);
  return listWhere({ organizationId, departmentId: null }, paging);
}

export async function listDepartmentInvitations(access: Access, departmentId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireDepartmentManager(departmentId);
  return listWhere({ departmentId }, paging);
}

async function resend(where: Prisma.InvitationWhereInput, target: { targetKind: string; targetName: string }) {
  const invitation = await prisma.invitation.findFirst({ where, include: invitationInclude });
  if (!invitation) {
    notFound();
  }

  if (invitation.acceptedAt) {
    conflict("This invite has already been accepted.");
  }

  if (invitation.revokedAt) {
    conflict("This invite has been revoked.");
  }

  const previous = {
    codeHash: invitation.codeHash,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
  const now = new Date();
  const code = await mailedCode();
  await guard(
    prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        codeHash: hashCode(code),
        expiresAt: new Date(now.getTime() + inviteMs),
        createdAt: now,
      },
    }),
  );
  try {
    await sendEmail(invitation.email, "invitation", {
      targetKind: target.targetKind,
      targetName: target.targetName,
      roleName: invitation.role.name,
      code,
      url: inviteUrl(code),
    });
  } catch (error) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: previous });
    throw error;
  }

  return invitationJson({ ...invitation, expiresAt: new Date(now.getTime() + inviteMs), createdAt: now });
}

export async function resendOrganizationInvitation(access: Access, organizationId: string, invitationId: string) {
  const organization = await access.requireOrganizationAdmin(organizationId);
  return resend({ id: invitationId, organizationId, departmentId: null }, inviteTarget(organization));
}

export async function revokeOrganizationInvitation(access: Access, organizationId: string, invitationId: string) {
  await access.requireOrganizationAdmin(organizationId);
  return revoke({ id: invitationId, organizationId, departmentId: null });
}

export async function revokeDepartmentInvitation(access: Access, departmentId: string, invitationId: string) {
  await access.requireDepartmentManager(departmentId);
  return revoke({ id: invitationId, departmentId });
}

function usable(invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date) {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now;
}

export const inviteEmailMismatch = "This invite was sent to a different email.";

export function acceptCodeFromNext(next: string) {
  const queryIndex = next.indexOf("?");
  const path = queryIndex === -1 ? next : next.slice(0, queryIndex);
  if (path !== "/accept") {
    return null;
  }

  const code = new URLSearchParams(queryIndex === -1 ? "" : next.slice(queryIndex + 1)).get("code")?.trim() ?? "";
  return code || null;
}

export function acceptAuthRedirect(code: string, userExists: boolean) {
  const next = `/accept?code=${encodeURIComponent(code)}`;
  return `${userExists ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`;
}

export async function invitationAccount(code: string) {
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }

  const found = await prisma.invitation.findUnique({ where: { codeHash: hashCode(trimmed) } });
  if (!found || !usable(found, new Date())) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { email: found.email }, select: { id: true } });
  return { email: found.email, userExists: user !== null };
}

export async function acceptInvitation(access: Access, request: AcceptInvitationRequest) {
  const caller = access.requireHuman();
  const now = new Date();
  const codeHash = hashCode(request.code);
  const found = await prisma.invitation.findUnique({ where: { codeHash } });
  if (!found || !usable(found, now)) {
    validation("The code is not valid.");
  }

  if (found.email !== caller.email) {
    throw new ApiError(403, "forbidden", inviteEmailMismatch);
  }

  const memberRoleId = await roleId("MEMBER");
  const accepted = await transaction(async (tx) => {
    await lockUser(tx, caller.id);
    const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: found.id } });
    if (!usable(invitation, now)) {
      validation("The code is not valid.");
    }

    const memberOfOrganization =
      (await tx.organizationMembership.count({
        where: { userId: caller.id, organizationId: invitation.organizationId },
      })) > 0;
    const newOrganizationMembership = async (membershipRoleId: string) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: invitation.organizationId },
        select: { defaultRateType: true },
      });
      return tx.organizationMembership.create({
        data: {
          userId: caller.id,
          organizationId: invitation.organizationId,
          roleId: membershipRoleId,
          rateType: organization.defaultRateType,
          isActive: true,
          joinedAt: now,
        },
        include: membershipInclude,
      });
    };

    let organizationMembership = null;
    let departmentMembership = null;
    if (invitation.departmentId) {
      const alreadyInDepartment =
        (await tx.departmentMembership.count({
          where: { userId: caller.id, departmentId: invitation.departmentId },
        })) > 0;
      if (alreadyInDepartment) {
        conflict("You are already a member.");
      }

      if (!memberOfOrganization) {
        organizationMembership = await newOrganizationMembership(memberRoleId);
      }

      departmentMembership = await tx.departmentMembership.create({
        data: { userId: caller.id, departmentId: invitation.departmentId, roleId: invitation.roleId, joinedAt: now },
        include: membershipInclude,
      });
    } else {
      if (memberOfOrganization) {
        conflict("You are already a member.");
      }

      organizationMembership = await newOrganizationMembership(invitation.roleId);
    }

    const saved = await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now },
      include: invitationInclude,
    });
    return { invitation: saved, organizationMembership, departmentMembership };
  });

  return {
    invitation: invitationJson(accepted.invitation),
    organizationMembership: accepted.organizationMembership
      ? orgMembershipJson(
          accepted.organizationMembership,
          accepted.invitation.departmentId ? [accepted.invitation.departmentId] : [],
        )
      : null,
    departmentMembership: accepted.departmentMembership
      ? departmentMembershipJson(accepted.departmentMembership, accepted.invitation.organizationId)
      : null,
  };
}
