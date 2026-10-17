import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { conflict, notFound } from "@/lib/api/errors";
import { list, page } from "@/lib/api/json";
import { NameRequest } from "@/lib/api/features/organizations";
import { prisma } from "@/lib/prisma";

function departmentJson(department: { id: string; organizationId: string; name: string }) {
  return { id: department.id, organizationId: department.organizationId, name: department.name };
}

async function managed(access: Access, departmentId: string) {
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department) {
    notFound();
  }

  await access.requireOrganization(department.organizationId, true);
  return department;
}

export async function listDepartments(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const departments = await prisma.department.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(departments.map(departmentJson), paging);
}

export async function createDepartment(access: Access, organizationId: string, request: NameRequest) {
  await access.requireOrganization(organizationId, true);
  return departmentJson(await guard(prisma.department.create({ data: { organizationId, name: request.name } })));
}

export async function getDepartment(access: Access, departmentId: string) {
  return departmentJson(await access.requireDepartment(departmentId));
}

export async function updateDepartment(access: Access, departmentId: string, request: NameRequest) {
  await managed(access, departmentId);
  return departmentJson(
    await guard(prisma.department.update({ where: { id: departmentId }, data: { name: request.name } })),
  );
}

export async function deleteDepartment(access: Access, departmentId: string) {
  await managed(access, departmentId);
  const referenced =
    (await prisma.userTimeEntry.count({ where: { departmentId } })) > 0 ||
    (await prisma.collectiveTimeEntry.count({ where: { departmentId } })) > 0;
  if (referenced) {
    conflict("Delete the time entries first.");
  }

  await guard(prisma.department.delete({ where: { id: departmentId } }));
}
