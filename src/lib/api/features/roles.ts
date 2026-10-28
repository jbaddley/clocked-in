import { randomUUID } from "node:crypto";
import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { conflict, notFound, validation } from "@/lib/api/errors";
import { Body, has, list, page, requireString } from "@/lib/api/json";
import {
  allPermissions,
  defaultPermissionsForCode,
  defaultScopeForCode,
  isPermission,
  type Permission,
  type RoleScope,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const roleInclude = { permissions: true } as const;

function normalizeScope(value: string): RoleScope {
  const scope = value.trim();
  if (scope !== "organization" && scope !== "assigned_groups" && scope !== "self") {
    validation("scope must be organization, assigned_groups, or self.");
  }
  return scope;
}

function codeFromName(name: string) {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return cleaned.length >= 2 ? cleaned : "CUSTOM";
}

function roleJson(role: {
  id: string;
  code: string;
  name: string;
  organizationId: string | null;
  isSystem: boolean;
  scope: string;
  permissions: { permission: string; allowed: boolean }[];
}) {
  const granted = role.permissions.length
    ? role.permissions.filter((item) => item.allowed).map((item) => item.permission)
    : defaultPermissionsForCode(role.code);
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    organizationId: role.organizationId,
    isSystem: role.isSystem,
    scope: role.scope,
    permissions: granted,
  };
}

export async function listOrganizationRoles(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const roles = await prisma.role.findMany({
    where: { OR: [{ organizationId: null }, { organizationId }] },
    include: roleInclude,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    skip: paging.offset,
    take: paging.limit,
  });
  return list(roles.map(roleJson), paging);
}

export function parseCreateRole(body: Body) {
  const name = requireString(body, "name").trim();
  if (name.length < 2 || name.length > 80) {
    validation("name must be 2 to 80 characters.");
  }
  const code = has(body, "code") ? requireString(body, "code").trim().toUpperCase() : codeFromName(name);
  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(code)) {
    validation("code must be 2 to 50 letters, numbers, or underscores.");
  }
  return {
    name,
    code,
    scope: has(body, "scope") ? normalizeScope(requireString(body, "scope")) : "assigned_groups",
    permissions: parsePermissions(body),
  };
}

export function parseUpdateRole(body: Body) {
  const request: {
    name?: string;
    scope?: RoleScope;
    permissions?: Permission[];
  } = {};
  if (has(body, "name")) {
    const name = requireString(body, "name").trim();
    if (name.length < 2 || name.length > 80) validation("name must be 2 to 80 characters.");
    request.name = name;
  }
  if (has(body, "scope")) {
    request.scope = normalizeScope(requireString(body, "scope"));
  }
  if (has(body, "permissions")) {
    request.permissions = parsePermissions(body);
  }
  if (!request.name && !request.scope && !request.permissions) {
    validation("Provide at least one field to update.");
  }
  return request;
}

function parsePermissions(body: Body) {
  const value = body.permissions;
  if (!Array.isArray(value)) {
    validation("permissions must be an array.");
  }
  const unique = [...new Set(value.map((item) => String(item)))];
  for (const item of unique) {
    if (!isPermission(item)) {
      validation(`Unknown permission ${item}.`);
    }
  }
  return unique as Permission[];
}

export async function createOrganizationRole(
  access: Access,
  organizationId: string,
  request: ReturnType<typeof parseCreateRole>,
) {
  await access.requirePermission(organizationId, "manage_roles");
  const existing = await prisma.role.findFirst({
    where: { code: request.code, OR: [{ organizationId: null }, { organizationId }] },
  });
  if (existing) {
    conflict("A role with that code already exists.");
  }
  const role = await guard(
    prisma.role.create({
      data: {
        id: randomUUID(),
        code: request.code,
        name: request.name,
        organizationId,
        isSystem: false,
        scope: request.scope,
        permissions: {
          create: request.permissions.map((permission) => ({ id: randomUUID(), permission, allowed: true })),
        },
      },
      include: roleInclude,
    }),
  );
  return roleJson(role);
}

export async function updateOrganizationRole(
  access: Access,
  organizationId: string,
  roleId: string,
  request: ReturnType<typeof parseUpdateRole>,
) {
  await access.requirePermission(organizationId, "manage_roles");
  const role = await prisma.role.findFirst({
    where: { id: roleId, OR: [{ organizationId: null }, { organizationId }] },
    include: roleInclude,
  });
  if (!role) notFound();
  if (role.isSystem && request.scope && request.scope !== role.scope) {
    validation("System role scope cannot change.");
  }
  if (role.isSystem && role.code === "ADMIN" && request.permissions) {
    if (!request.permissions.includes("manage_roles") || !request.permissions.includes("manage_members")) {
      validation("Admin must keep manage_roles and manage_members.");
    }
  }
  const updated = await guard(
    prisma.$transaction(async (tx) => {
      if (request.permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: request.permissions.map((permission) => ({
            id: randomUUID(),
            roleId,
            permission,
            allowed: true,
          })),
        });
      }
      return tx.role.update({
        where: { id: roleId },
        data: {
          name: request.name,
          scope: role.isSystem ? undefined : request.scope,
        },
        include: roleInclude,
      });
    }),
  );
  return roleJson(updated);
}

export async function deleteOrganizationRole(access: Access, organizationId: string, roleId: string) {
  await access.requirePermission(organizationId, "manage_roles");
  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId } });
  if (!role) notFound();
  if (role.isSystem) {
    validation("System roles cannot be deleted.");
  }
  const assigned =
    (await prisma.organizationMembership.count({ where: { roleId } })) +
    (await prisma.departmentMembership.count({ where: { roleId } })) +
    (await prisma.invitation.count({ where: { roleId, acceptedAt: null, revokedAt: null } }));
  if (assigned > 0) {
    conflict("This role is still assigned.");
  }
  await guard(prisma.role.delete({ where: { id: roleId } }));
}

export { defaultPermissionsForCode, defaultScopeForCode, allPermissions };
