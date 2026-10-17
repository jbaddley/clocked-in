import { Prisma } from "@/generated/prisma/client";
import { forbidden, notFound, unauthorized } from "@/lib/api/errors";
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

  constructor(readonly caller: Account) {}

  async requireOrganization(organizationId: string, admin: boolean) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { theme: true },
    });
    if (!organization) {
      notFound();
    }

    if (this.caller.isSuperAdmin) {
      return organization;
    }

    const membership = (await this.organizationMemberships()).get(organizationId);
    if (!membership || !membership.isActive || (admin && membership.role !== "ADMIN")) {
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
      !this.caller.isSuperAdmin &&
      !(await this.isOrgAdmin(department.organizationId)) &&
      !(await this.isDepartmentAdmin(departmentId))
    ) {
      forbidden();
    }

    return department;
  }

  async isOrgAdmin(organizationId: string) {
    const membership = (await this.organizationMemberships()).get(organizationId);
    return membership !== undefined && membership.isActive && membership.role === "ADMIN";
  }

  async isOrgVolunteer(organizationId: string) {
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
    this.organizations ??= new Map(
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
    this.departments ??= (
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

export async function authenticate(request: Request) {
  const subject = await readAccessSubject(request);
  if (!parseGuid(subject)) {
    unauthorized();
  }

  return (await accessForSubject(subject)) ?? unauthorized("This token is not valid for this server.");
}
