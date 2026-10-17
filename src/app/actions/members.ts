"use server";

import {
  createOrganizationInvitation,
  parseCreateInvitation,
  resendOrganizationInvitation,
  revokeOrganizationInvitation,
} from "@/lib/api/features/invitations";
import {
  createOrgMembership,
  deleteOrgMembership,
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

export async function inviteMemberAction(organizationId: string, email: string, role: string) {
  return run(async () => {
    const access = await requireAccess();
    await createOrganizationInvitation(access, organizationId, parseCreateInvitation({ email, role }));
  }, `Invitation sent to ${email}.`);
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
