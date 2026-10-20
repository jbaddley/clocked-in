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
import { prisma } from "@/lib/prisma";

export const accountInclude = { profile: true } as const;
export type Account = Prisma.UserGetPayload<{ include: typeof accountInclude }>;

type CallerOrganization = { isActive: boolean; role: RoleCode | null };
type CallerDepartment = { departmentId: string; organizationId: string; isAdmin: boolean };

export class Access {
  private organizations?: Map<string, CallerOrganization>;
  private departments?: CallerDepartment[];

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
    if (!membership || !membership.isActive || (admin && membership.role !== "ADMIN")) {
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
      !(await this.isOrgAdmin(department.organizationId)) &&
      !(await this.isDepartmentAdmin(departmentId))
    ) {
      forbidden();
    }

    return department;
  }

  async isOrgAdmin(organizationId: string) {
    if (this.apiKey) {
      return this.apiKey.organizationId === organizationId && this.apiKey.isAdmin;
    }

    const membership = (await this.organizationMemberships()).get(organizationId);
    return membership !== undefined && membership.isActive && membership.role === "ADMIN";
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
    return [...(await this.organizationMemberships()).entries()]
      .filter(([, membership]) => membership.isActive && membership.role !== "VOLUNTEER")
      .map(([organizationId]) => organizationId);
  }

  async isDepartmentAdmin(departmentId: string) {
    const department = (await this.departmentMemberships()).find((item) => item.departmentId === departmentId);
    if (!department || !department.isAdmin) {
      return false;
    }

    return (await this.organizationMemberships()).get(department.organizationId)?.isActive === true;
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

  private async organizationMemberships() {
    if (this.organizations) {
      return this.organizations;
    }

    if (this.apiKey) {
      this.organizations = new Map([[this.apiKey.organizationId, { isActive: true, role: this.apiKey.isAdmin ? "ADMIN" : "MEMBER" }]]);
      return this.organizations;
    }

    this.organizations = new Map(
      (
        await prisma.organizationMembership.findMany({
          where: { userId: this.caller.id },
          select: { organizationId: true, isActive: true, role: { select: { code: true } } },
        })
      ).map((membership) => [
        membership.organizationId,
        {
          isActive: membership.isActive,
          role:
            membership.role.code === "ADMIN" || membership.role.code === "MEMBER" || membership.role.code === "VOLUNTEER"
              ? membership.role.code
              : null,
        },
      ]),
    );
    return this.organizations;
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
