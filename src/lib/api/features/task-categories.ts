import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { conflict, notFound } from "@/lib/api/errors";
import { list, page } from "@/lib/api/json";
import { NameRequest } from "@/lib/api/features/organizations";
import { prisma } from "@/lib/prisma";

function taskCategoryJson(category: { id: string; organizationId: string; name: string }) {
  return { id: category.id, organizationId: category.organizationId, name: category.name };
}

async function managed(access: Access, categoryId: string) {
  const category = await prisma.taskCategory.findUnique({ where: { id: categoryId } });
  if (!category) {
    notFound();
  }

  await access.requireOrganization(category.organizationId, true);
  return category;
}

export async function listTaskCategories(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const categories = await prisma.taskCategory.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(categories.map(taskCategoryJson), paging);
}

export async function createTaskCategory(access: Access, organizationId: string, request: NameRequest) {
  await access.requireOrganization(organizationId, true);
  return taskCategoryJson(await guard(prisma.taskCategory.create({ data: { organizationId, name: request.name } })));
}

export async function updateTaskCategory(access: Access, categoryId: string, request: NameRequest) {
  await managed(access, categoryId);
  return taskCategoryJson(
    await guard(prisma.taskCategory.update({ where: { id: categoryId }, data: { name: request.name } })),
  );
}

export async function deleteTaskCategory(access: Access, categoryId: string) {
  await managed(access, categoryId);
  const referenced =
    (await prisma.userTimeEntry.count({ where: { taskCategoryId: categoryId } })) > 0 ||
    (await prisma.collectiveTimeEntry.count({ where: { taskCategoryId: categoryId } })) > 0;
  if (referenced) {
    conflict("Delete the time entries first.");
  }

  await guard(prisma.taskCategory.delete({ where: { id: categoryId } }));
}
