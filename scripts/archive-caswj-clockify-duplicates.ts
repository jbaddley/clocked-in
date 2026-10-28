import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const organizationName = process.env.CASWJ_ORG_NAME?.trim() || "Cultural Arts Society of West Jordan";
  const organization = await prisma.organization.findFirst({
    where: { name: { equals: organizationName, mode: "insensitive" } },
    include: { departments: true, projects: true, tags: true },
  });
  if (!organization) {
    throw new Error(`Organization ${organizationName} was not found.`);
  }

  const departmentNames = new Set(organization.departments.map((department) => department.name.toLowerCase()));
  const duplicateProjects = organization.projects.filter((project) => departmentNames.has(project.title.toLowerCase()));
  const duplicateTags = organization.tags.filter((tag) => /^\((org|type)\)/i.test(tag.name));

  await prisma.project.updateMany({
    where: { id: { in: duplicateProjects.map((project) => project.id) } },
    data: { isActive: false },
  });
  await prisma.tag.updateMany({
    where: { id: { in: duplicateTags.map((tag) => tag.id) } },
    data: { isArchived: true },
  });

  console.log(
    `Archived ${duplicateProjects.length} projects that match group names and ${duplicateTags.length} (Org)/(Type) tags.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
