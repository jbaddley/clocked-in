"use server";

import {
  createDepartmentInvitation,
  createOrganizationInvitation,
  parseCreateInvitation,
  resendOrganizationInvitation,
  revokeDepartmentInvitation,
  revokeOrganizationInvitation,
} from "@/lib/api/features/invitations";
import {
  createOrgMembership,
  deleteOrgMembership,
  deleteOrgMemberships,
  parseCreateOrgMembership,
  parseUpdateOrgMembership,
  updateOrgMembership,
} from "@/lib/api/features/memberships";
import { body, run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export type MemberPatch = {
  role?: string;
  rateType?: string;
  professionalBillingRate?: number | null;
  isActive?: boolean;
  primaryDepartmentId?: string | null;
  departmentIds?: string[];
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  timezone?: string;
  phone?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  email?: string;
};

export type NewPerson = {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  timezone?: string;
  phone?: string | null;
  zipCode?: string | null;
  notes?: string | null;
  role: string;
  departmentIds?: string[];
  relationship?: string;
};

export async function createPersonAction(organizationId: string, input: NewPerson) {
  return run(async () => {
    const access = await requireAccess();
    return createOrgMembership(access, organizationId, parseCreateOrgMembership(body(input)));
  }, "Person added.");
}

export async function updateMemberAction(organizationId: string, membershipId: string, patch: MemberPatch) {
  return run(async () => {
    const access = await requireAccess();
    return updateOrgMembership(access, organizationId, membershipId, parseUpdateOrgMembership(body(patch)));
  }, "Person saved.");
}

export async function removeMemberAction(organizationId: string, membershipId: string) {
  return run(async () => {
    const access = await requireAccess();
    await deleteOrgMembership(access, organizationId, membershipId);
  }, "Person removed from the organization.");
}

export async function removeMembersAction(organizationId: string, membershipIds: string[]) {
  const count = new Set(membershipIds).size;
  return run(async () => {
    const access = await requireAccess();
    await deleteOrgMemberships(access, organizationId, membershipIds);
  }, count === 1 ? "Person removed from the organization." : `${count} people removed from the organization.`);
}

export async function inviteMemberAction(organizationId: string, email: string, role: string) {
  return run(async () => {
    const access = await requireAccess();
    await createOrganizationInvitation(access, organizationId, parseCreateInvitation({ email, role }));
  }, `Invitation sent to ${email}.`);
}

export async function inviteDepartmentMemberAction(departmentId: string, email: string, role: string) {
  return run(async () => {
    const access = await requireAccess();
    await createDepartmentInvitation(access, departmentId, parseCreateInvitation({ email, role }));
  }, `Invitation sent to ${email}.`);
}

export async function revokeDepartmentInvitationAction(departmentId: string, invitationId: string) {
  return run(async () => {
    const access = await requireAccess();
    await revokeDepartmentInvitation(access, departmentId, invitationId);
  }, "Invitation revoked.");
}

export async function resendInvitationAction(organizationId: string, invitationId: string, email: string) {
  return run(async () => {
    const access = await requireAccess();
    await resendOrganizationInvitation(access, organizationId, invitationId);
  }, `Invitation resent to ${email}.`);
}

export async function revokeInvitationAction(organizationId: string, invitationId: string) {
  return run(async () => {
    const access = await requireAccess();
    await revokeOrganizationInvitation(access, organizationId, invitationId);
  }, "Invitation revoked.");
}
