import { Prisma } from "@/generated/prisma/client";
import {
  apiKeyMatches,
  parseScopes,
  prefixOf,
  presentedApiKey,
  principalFromScopes,
  verifyDummyApiKey,
  type ApiKeyPrincipal,
} from "@/lib/api/api-key";
import { forbidden, notFound, passwordChangeRequired, unauthorized } from "@/lib/api/errors";
import { parseGuid } from "@/lib/api/guid";
import { type RoleCode } from "@/lib/api/json";
import { readAccessSubject } from "@/lib/api/security";
import {
  apiKeyPermissions,
  defaultPermissionsForCode,
  defaultScopeForCode,
  groupManagerPermissions,
  type Permission,
  type RoleScope,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const accountInclude = { profile: true } as const;
export type Account = Prisma.UserGetPayload<{ include: typeof accountInclude }>;

type CallerOrganization = { isActive: boolean; role: RoleCode | null; roleId: string | null; scope: RoleScope };
type CallerDepartment = { departmentId: string; organizationId: string; isAdmin: boolean };

function roleScopeFrom(scope: string, code: string): RoleScope {
  if (scope === "organization" || scope === "assigned_groups" || scope === "self") {
    return scope;
  }
  return defaultScopeForCode(code);
}

export class Access {
  private organizations?: Map<string, CallerOrganization>;
  private departments?: CallerDepartment[];
  private permissionSets?: Map<string, Set<Permission>>;

  constructor(
    private readonly account: Account | null,
    private readonly apiKey: ApiKeyPrincipal | null = null,
  ) {}

  get caller(): Account {
    return this.account ?? unauthorized();
  }

  get isApiKey() {
    return this.apiKey !== null;
  }

  get isSuperAdmin() {
    return this.account?.isSuperAdmin ?? false;
  }

  get actorUserId() {
    return this.account?.id ?? this.apiKey?.createdByUserId ?? unauthorized();
  }

  requireHuman() {
    return this.account ?? forbidden();
  }

  canWrite(organizationId: string) {
    return this.apiKey !== null && this.apiKey.organizationId === organizationId && this.apiKey.canWrite;
  }

  async requireOrganization(organizationId: string, admin: boolean) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { theme: true },
    });
    if (!organization) {
      notFound();
    }

    if (this.apiKey) {
      if (this.apiKey.organizationId !== organizationId) {
        forbidden();
      }

      if (admin ? !this.apiKey.canWrite : !this.apiKey.canRead) {
        forbidden();
      }

      return organization;
    }

    if (this.isSuperAdmin) {
      return organization;
    }

    const membership = (await this.organizationMemberships()).get(organizationId);
    if (!membership || !membership.isActive || (admin && !(await this.can(organizationId, "manage_organization")))) {
      forbidden();
    }

    return organization;
  }

  async requireOrganizationAdmin(organizationId: string) {
    const organization = await this.requireOrganization(organizationId, true);
    if (this.apiKey && !this.apiKey.isAdmin) {
      forbidden();
    }

    return organization;
  }

  async requireDepartment(departmentId: string) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      notFound();
    }

    await this.requireOrganization(department.organizationId, false);
    return department;
  }

  async requireDepartmentManager(departmentId: string) {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      notFound();
    }

    if (
      !this.isSuperAdmin &&
      !(await this.can(department.organizationId, "manage_organization")) &&
      !(await this.can(department.organizationId, "invite_members", departmentId)) &&
      !(await this.isDepartmentAdmin(departmentId))
    ) {
      forbidden();
    }

    return department;
  }

  async can(organizationId: string, permission: Permission, departmentId?: string | null) {
    if (this.isSuperAdmin) {
      return true;
    }

    if (this.apiKey) {
      if (this.apiKey.organizationId !== organizationId) {
        return false;
      }
      return apiKeyPermissions(this.apiKey.isAdmin, this.apiKey.canWrite).includes(permission);
    }

    const membership = (await this.organizationMemberships()).get(organizationId);
    if (!membership?.isActive) {
      return false;
    }

    const granted = await this.permissionsFor(organizationId);
    if (!granted.has(permission)) {
      return false;
    }

    if (departmentId && groupManagerPermissions.includes(permission) && membership.role !== "ADMIN") {
      return this.isDepartmentAdmin(departmentId);
    }

    return true;
  }

  /** Saving report designs: an admin API key, or a person with manage_organization or design_reports. */
  async requireReportDesigner(organizationId: string) {
    if (this.apiKey) {
      return this.requireOrganizationAdmin(organizationId);
    }

    const organization = await this.requireOrganization(organizationId, false);
    if (!(await this.can(organizationId, "manage_organization")) && !(await this.can(organizationId, "design_reports"))) {
      forbidden();
    }
    return organization;
  }

  async requirePermission(organizationId: string, permission: Permission, departmentId?: string | null) {
    const organization = await this.requireOrganization(organizationId, false);
    if (!(await this.can(organizationId, permission, departmentId))) {
      forbidden();
    }
    return organization;
  }

  async permissionsFor(organizationId: string) {
    if (!this.permissionSets) {
      this.permissionSets = new Map();
    }

    const cached = this.permissionSets.get(organizationId);
    if (cached) {
      return cached;
    }

    if (this.isSuperAdmin) {
      const all = new Set(apiKeyPermissions(true, true));
      this.permissionSets.set(organizationId, all);
      return all;
    }

    if (this.apiKey) {
      const granted = new Set(apiKeyPermissions(this.apiKey.isAdmin, this.apiKey.canWrite));
      this.permissionSets.set(organizationId, granted);
      return granted;
    }

    const membership = (await this.organizationMemberships()).get(organizationId);
    const granted = new Set<Permission>(defaultPermissionsForCode(membership?.role));
    if (membership?.roleId) {
      const rows = await prisma.rolePermission.findMany({
        where: { roleId: membership.roleId, allowed: true },
        select: { permission: true },
      });
      if (rows.length > 0) {
        granted.clear();
        for (const row of rows) {
          if (apiKeyPermissions(true, true).includes(row.permission as Permission)) {
            granted.add(row.permission as Permission);
          }
        }
      }
    }

    if ((await this.adminDepartmentIds(organizationId)).length > 0) {
      for (const permission of groupManagerPermissions) {
        granted.add(permission);
      }
    }

    this.permissionSets.set(organizationId, granted);
    return granted;
  }

  async isOrgAdmin(organizationId: string) {
    return this.can(organizationId, "manage_organization");
  }

  async isOrgVolunteer(organizationId: string) {
    if (this.apiKey) {
      return false;
    }

    const membership = (await this.organizationMemberships()).get(organizationId);
    return membership !== undefined && membership.isActive && membership.role === "VOLUNTEER";
  }

  async organizationRole(organizationId: string) {
    const membership = (await this.organizationMemberships()).get(organizationId);
    return membership?.isActive ? membership.role : null;
  }

  async organizationsWhereCallerCanReadOthers() {
    const ids: string[] = [];
    for (const [organizationId, membership] of await this.organizationMemberships()) {
      if (!membership.isActive) continue;
      if (
        (await this.can(organizationId, "log_member_time")) ||
        (await this.can(organizationId, "view_reports")) ||
        (await this.can(organizationId, "manage_members"))
      ) {
        ids.push(organizationId);
      }
    }
    return ids;
  }

  async isDepartmentAdmin(departmentId: string) {
    const department = (await this.departmentMemberships()).find((item) => item.departmentId === departmentId);
    if (!department || !department.isAdmin) {
      return false;
    }

    return (await this.organizationMemberships()).get(department.organizationId)?.isActive === true;
  }

  async roleScope(organizationId: string): Promise<RoleScope> {
    const membership = (await this.organizationMemberships()).get(organizationId);
    return membership?.scope ?? defaultScopeForCode(membership?.role);
  }

  async assignedDepartmentIds(organizationId: string) {
    const membership = (await this.organizationMemberships()).get(organizationId);
    if (!membership?.isActive) {
      return [];
    }

    return (await this.departmentMemberships())
      .filter((item) => item.organizationId === organizationId)
      .map((item) => item.departmentId);
  }

  async visibility(organizationId: string): Promise<
    { kind: "all" } | { kind: "departments"; departmentIds: string[] } | { kind: "self" }
  > {
    if (this.isSuperAdmin || this.isApiKey || (await this.isOrgAdmin(organizationId))) {
      return { kind: "all" };
    }

    const scope = await this.roleScope(organizationId);
    if (scope === "assigned_groups") {
      return { kind: "departments", departmentIds: await this.assignedDepartmentIds(organizationId) };
    }

    const adminDepartments = await this.adminDepartmentIds(organizationId);
    if (adminDepartments.length > 0) {
      return { kind: "departments", departmentIds: adminDepartments };
    }

    if (scope === "self" || (await this.isOrgVolunteer(organizationId))) {
      return { kind: "self" };
    }

    return { kind: "all" };
  }

  async adminDepartmentIds(organizationId: string) {
    const membership = (await this.organizationMemberships()).get(organizationId);
    if (!membership?.isActive) {
      return [];
    }

    return (await this.departmentMemberships())
      .filter((item) => item.organizationId === organizationId && item.isAdmin)
      .map((item) => item.departmentId);
  }

  async activeOrganizationIds() {
    return [...(await this.organizationMemberships()).entries()]
      .filter(([, membership]) => membership.isActive)
      .map(([organizationId]) => organizationId);
  }

  async departmentIds() {
    return (await this.departmentMemberships()).map((item) => item.departmentId);
  }

  async sharedOrganizationIds(otherUserId: string) {
    const organizationIds = await this.activeOrganizationIds();
    if (organizationIds.length === 0) {
      return [];
    }

    const shared = await prisma.organizationMembership.findMany({
      where: { userId: otherUserId, organizationId: { in: organizationIds } },
      select: { organizationId: true },
    });
    return shared.map((membership) => membership.organizationId);
  }

  private async organizationMemberships(): Promise<Map<string, CallerOrganization>> {
    if (this.organizations) {
      return this.organizations;
    }

    if (this.apiKey) {
      const organizations = new Map<string, CallerOrganization>([
        [this.apiKey.organizationId, { isActive: true, role: this.apiKey.isAdmin ? "ADMIN" : "MEMBER", roleId: null, scope: "organization" }],
      ]);
      this.organizations = organizations;
      return organizations;
    }

    const organizations = new Map<string, CallerOrganization>(
      (
        await prisma.organizationMembership.findMany({
          where: { userId: this.caller.id },
          select: { organizationId: true, isActive: true, roleId: true, role: { select: { code: true, scope: true } } },
        })
      ).map((membership) => [
        membership.organizationId,
        {
          isActive: membership.isActive,
          roleId: membership.roleId,
          role: membership.role.code || null,
          scope: roleScopeFrom(membership.role.scope, membership.role.code),
        },
      ]),
    );
    this.organizations = organizations;
    return organizations;
  }

  private async departmentMemberships() {
    if (this.departments) {
      return this.departments;
    }

    if (this.apiKey) {
      const key = this.apiKey;
      const departments = await prisma.department.findMany({
        where: { organizationId: key.organizationId },
        select: { id: true, organizationId: true },
      });
      this.departments = departments.map((department) => ({
        departmentId: department.id,
        organizationId: department.organizationId,
        isAdmin: key.canWrite,
      }));
      return this.departments;
    }

    this.departments = (
      await prisma.departmentMembership.findMany({
        where: { userId: this.caller.id },
        select: { departmentId: true, department: { select: { organizationId: true } }, role: { select: { code: true } } },
      })
    ).map((membership) => ({
      departmentId: membership.departmentId,
      organizationId: membership.department.organizationId,
      isAdmin: membership.role.code === "ADMIN",
    }));
    return this.departments;
  }
}

export async function accessForSubject(subject: string) {
  const id = parseGuid(subject);
  if (!id) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { id }, include: accountInclude });
  return user ? new Access(user) : null;
}

async function authenticateApiKey(raw: string) {
  const prefix = prefixOf(raw);
  if (!prefix) {
    verifyDummyApiKey(raw);
    unauthorized();
  }

  const keys = await prisma.organizationApiKey.findMany({ where: { prefix, revokedAt: null } });
  const match = keys.find((item) => apiKeyMatches(raw, item.keyHash));
  if (!match) {
    verifyDummyApiKey(raw);
    unauthorized();
  }

  if (match.expiresAt && match.expiresAt.getTime() <= Date.now()) {
    unauthorized();
  }

  try {
    await prisma.organizationApiKey.update({ where: { id: match.id }, data: { lastUsedAt: new Date() } });
  } catch (error) {
    console.warn("Could not record API key last-used time.", error);
  }

  return new Access(null, principalFromScopes(match, parseScopes(match.scopes)));
}

export async function authenticate(request: Request, options?: { allowPasswordChange?: boolean }) {
  const rawKey = presentedApiKey(request);
  if (rawKey) {
    return authenticateApiKey(rawKey);
  }

  const subject = await readAccessSubject(request);
  if (!parseGuid(subject)) {
    unauthorized();
  }

  const access = (await accessForSubject(subject)) ?? unauthorized("This token is not valid for this server.");
  if (access.caller.mustChangePassword && !options?.allowPasswordChange) {
    passwordChangeRequired();
  }

  return access;
}
