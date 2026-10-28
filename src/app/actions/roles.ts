"use server";

import {
  createOrganizationRole,
  deleteOrganizationRole,
  parseCreateRole,
  parseUpdateRole,
  updateOrganizationRole,
} from "@/lib/api/features/roles";
import { body, run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export async function createRoleAction(
  organizationId: string,
  input: { name: string; code?: string; scope?: string; permissions: string[] },
) {
  return run(async () => {
    const access = await requireAccess();
    return createOrganizationRole(access, organizationId, parseCreateRole(body(input)));
  }, "Role created.");
}

export async function updateRoleAction(
  organizationId: string,
  roleId: string,
  input: { name?: string; scope?: string; permissions?: string[] },
) {
  return run(async () => {
    const access = await requireAccess();
    return updateOrganizationRole(access, organizationId, roleId, parseUpdateRole(body(input)));
  }, "Role saved.");
}

export async function deleteRoleAction(organizationId: string, roleId: string) {
  return run(async () => {
    const access = await requireAccess();
    await deleteOrganizationRole(access, organizationId, roleId);
  }, "Role deleted.");
}
