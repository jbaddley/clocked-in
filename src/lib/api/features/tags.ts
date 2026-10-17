import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { notFound } from "@/lib/api/errors";
import { list, page } from "@/lib/api/json";
import { NameRequest } from "@/lib/api/features/organizations";
import { prisma } from "@/lib/prisma";

function tagJson(tag: { id: string; organizationId: string; name: string }) {
  return { id: tag.id, organizationId: tag.organizationId, name: tag.name };
}

async function managed(access: Access, tagId: string) {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) {
    notFound();
  }

  await access.requireOrganization(tag.organizationId, true);
  return tag;
}

export async function listTags(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const tags = await prisma.tag.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(tags.map(tagJson), paging);
}

export async function createTag(access: Access, organizationId: string, request: NameRequest) {
  await access.requireOrganization(organizationId, true);
  return tagJson(await guard(prisma.tag.create({ data: { organizationId, name: request.name } })));
}

export async function updateTag(access: Access, tagId: string, request: NameRequest) {
  await managed(access, tagId);
  return tagJson(await guard(prisma.tag.update({ where: { id: tagId }, data: { name: request.name } })));
}

export async function deleteTag(access: Access, tagId: string) {
  await managed(access, tagId);
  await guard(prisma.tag.delete({ where: { id: tagId } }));
}
