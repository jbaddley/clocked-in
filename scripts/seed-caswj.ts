import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client";
import { prismaPoolConfig } from "../src/lib/prisma-connection";
import {
  baseCaswjTheme,
  baseCaswjThemeName,
  caswjLabels,
  caswjSourceRefPrefix,
  clockedInThemeId,
  departmentNames,
  inKindFromMinutes,
  loadCaswjWorkbook,
  localEmail,
  money,
  onDate,
  orgName,
  slug,
} from "./caswj-workbook";

const envFiles = { local: ".env", staging: ".env.staging", production: ".env.production" } as const;
const appEnv = process.env.APP_ENV === "production" || process.env.APP_ENV === "staging" ? process.env.APP_ENV : "local";
config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../${envFiles[appEnv]}`) });

function prismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return new PrismaClient({ adapter: new PrismaPg(prismaPoolConfig(connectionString, { pooled: false })) });
}

async function main() {
  const password = process.env.SEED_SUPERADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("SEED_SUPERADMIN_PASSWORD is required.");
  }

  const { categories, projectTitles, people, logRows } = await loadCaswjWorkbook();
  const db = prismaClient();
  try {
    const [adminRole, volunteerRole] = await Promise.all([
      db.role.findUniqueOrThrow({ where: { code: "ADMIN" } }),
      db.role.findUniqueOrThrow({ where: { code: "VOLUNTEER" } }),
    ]);
    const adminHash = await bcrypt.hash(password, 12);
    const organization =
      (await db.organization.findFirst({ where: { name: orgName } })) ??
      (await db.organization.create({
        data: {
          name: orgName,
          rateSourceYear: 2025,
          defaultRateType: "Volunteer",
          themeId: clockedInThemeId,
          preferences: {
            allowTimeEntryEditing: true,
            entityLabels: caswjLabels,
          },
        },
      }));
    const theme =
      (await db.theme.findFirst({ where: { organizationId: organization.id, name: baseCaswjThemeName } })) ??
      (await db.theme.create({
        data: {
          organizationId: organization.id,
          ...baseCaswjTheme,
        },
      }));
    await db.theme.update({
      where: { id: theme.id },
      data: baseCaswjTheme,
    });
    await db.organization.update({
      where: { id: organization.id },
      data: {
        rateSourceYear: 2025,
        defaultRateType: "Volunteer",
        themeId: theme.id,
        preferences: { allowTimeEntryEditing: true, entityLabels: caswjLabels },
      },
    });

    const admin =
      (await db.user.findFirst({ where: { OR: [{ username: "jbaddley" }, { email: "jasonbaddley+caswj@gmail.com" }] } })) ??
      (await db.user.create({
        data: {
          username: "jbaddley",
          email: "jasonbaddley+caswj@gmail.com",
          passwordHash: adminHash,
          isSuperAdmin: true,
          profile: { create: { firstName: "Jason", lastName: "Baddley", displayName: "Jason Baddley" } },
        },
      }));
    await db.user.update({
      where: { id: admin.id },
      data: { username: "jbaddley", email: "jasonbaddley+caswj@gmail.com", passwordHash: adminHash, isSuperAdmin: true },
    });
    await db.organizationMembership.upsert({
      where: { userId_organizationId: { userId: admin.id, organizationId: organization.id } },
      update: { roleId: adminRole.id, isActive: true },
      create: { userId: admin.id, organizationId: organization.id, roleId: adminRole.id, rateType: "Volunteer", isActive: true },
    });

    const departments = new Map<string, string>();
    for (const name of departmentNames) {
      const department =
        (await db.department.findFirst({ where: { organizationId: organization.id, name: { equals: name, mode: "insensitive" } } })) ??
        (await db.department.create({ data: { organizationId: organization.id, name } }));
      departments.set(name.toLowerCase(), department.id);
    }

    for (const name of categories) {
      const existing = await db.taskCategory.findFirst({
        where: { organizationId: organization.id, name: { equals: name, mode: "insensitive" } },
      });
      if (!existing) {
        await db.taskCategory.create({ data: { organizationId: organization.id, name } });
      }
    }

    const categoryIds = new Map(
      (await db.taskCategory.findMany({ where: { organizationId: organization.id } })).map((row) => [row.name.toLowerCase(), row.id]),
    );
    const tags = new Map<string, string>();
    for (const name of new Set(logRows.flatMap((row) => row.tags))) {
      const existing =
        (await db.tag.findFirst({ where: { organizationId: organization.id, name: { equals: name, mode: "insensitive" } } })) ??
        (await db.tag.create({ data: { organizationId: organization.id, name } }));
      tags.set(name.toLowerCase(), existing.id);
    }

    for (const title of projectTitles) {
      const existing = await db.project.findFirst({
        where: { organizationId: organization.id, title: { equals: title, mode: "insensitive" } },
      });
      if (!existing) {
        await db.project.create({
          data: {
            organizationId: organization.id,
            ownerUserId: admin.id,
            title,
            accessType: "Public",
            isActive: true,
          },
        });
      }
    }

    const projectIds = new Map(
      (await db.project.findMany({ where: { organizationId: organization.id } })).map((row) => [row.title.toLowerCase(), row.id]),
    );
    let rate = await db.hourlyRate.findFirst({ where: { organizationId: organization.id, isDefault: true } });
    if (!rate) {
      rate = await db.hourlyRate.create({
        data: {
          organizationId: organization.id,
          type: "Volunteer",
          name: "Utah Volunteer Rate",
          perHourRate: 35.47,
          isDefault: true,
        },
      });
    } else if (rate.name !== "Utah Volunteer Rate" || Number(rate.perHourRate) !== 35.47) {
      rate = await db.hourlyRate.update({
        where: { id: rate.id },
        data: { name: "Utah Volunteer Rate", perHourRate: 35.47, type: "Volunteer", isArchived: false },
      });
    }

    const usersByName = new Map<string, string>();
    for (const person of people.values()) {
      const usernameBase = slug(person.displayName) || slug(`${person.firstName} ${person.lastName}`) || "volunteer";
      const username = usernameBase.slice(0, 50);
      const email = localEmail(username);
      const existing =
        (await db.user.findFirst({ where: { OR: [{ username }, { email }] } })) ??
        (await db.user.create({
          data: {
            username,
            email,
            passwordHash: await bcrypt.hash(randomBytes(16).toString("base64url"), 12),
            profile: {
              create: {
                firstName: person.firstName,
                lastName: person.lastName,
                displayName: person.displayName,
                memberNumber: person.memberNumber,
              },
            },
          },
        }));
      await db.userProfile.upsert({
        where: { userId: existing.id },
        update: {
          firstName: person.firstName,
          lastName: person.lastName,
          displayName: person.displayName,
          memberNumber: person.memberNumber,
        },
        create: {
          userId: existing.id,
          firstName: person.firstName,
          lastName: person.lastName,
          displayName: person.displayName,
          memberNumber: person.memberNumber,
        },
      });
      await db.organizationMembership.upsert({
        where: { userId_organizationId: { userId: existing.id, organizationId: organization.id } },
        update: { isActive: person.displayName.toLowerCase() === "clockify import" ? false : person.active, roleId: volunteerRole.id },
        create: {
          userId: existing.id,
          organizationId: organization.id,
          roleId: volunteerRole.id,
          rateType: "Volunteer",
          isActive: person.displayName.toLowerCase() === "clockify import" ? false : person.active,
        },
      });
      usersByName.set(person.displayName.toLowerCase(), existing.id);
    }

    const unnamed =
      (await db.user.findFirst({ where: { username: "caswj.unnamed" } })) ??
      (await db.user.create({
        data: {
          username: "caswj.unnamed",
          email: localEmail("caswj.unnamed"),
          passwordHash: await bcrypt.hash(randomBytes(16).toString("base64url"), 12),
          profile: { create: { firstName: "", lastName: "", displayName: "" } },
        },
      }));
    await db.organizationMembership.upsert({
      where: { userId_organizationId: { userId: unnamed.id, organizationId: organization.id } },
      update: { roleId: volunteerRole.id, isActive: true },
      create: { userId: unnamed.id, organizationId: organization.id, roleId: volunteerRole.id, rateType: "Volunteer", isActive: true },
    });

    let created = 0;
    let skipped = 0;
    for (const row of logRows) {
      const sourceRef = `${caswjSourceRefPrefix}${row.sheetRow}`;
      const existing = await db.userTimeEntry.findUnique({ where: { sourceRef } });
      if (existing) {
        skipped += 1;
        continue;
      }

      const userId = row.volunteer ? usersByName.get(row.volunteer.toLowerCase()) : unnamed.id;
      if (!userId) {
        throw new Error(`Missing volunteer ${row.volunteer} on row ${row.sheetRow}.`);
      }

      const groupKey = row.group.toLowerCase();
      const departmentId = !groupKey || groupKey === "caswj" ? null : departments.get(groupKey);
      const projectId = projectIds.get(row.project.toLowerCase());
      const taskCategoryId = categoryIds.get(row.category.toLowerCase());
      if (!projectId || !taskCategoryId) {
        throw new Error(`Missing project or category on row ${row.sheetRow}.`);
      }

      const enteredByUserId = row.enteredBy.toLowerCase() === "clockify import" ? usersByName.get("clockify import") ?? admin.id : admin.id;
      const minutes = Math.round(row.hours * 60);
      if (minutes < 1 || minutes > 59940) {
        throw new Error(`Hours on row ${row.sheetRow} are outside the Total range (${row.hours}).`);
      }

      const hourlyRate = money(row.hourlyRate);
      const inKindValue = inKindFromMinutes(minutes, hourlyRate);
      let entry;
      try {
        entry = await db.userTimeEntry.create({
          data: {
            userId,
            enteredByUserId,
            organizationId: organization.id,
            departmentId,
            projectId,
            taskCategoryId,
            hourlyRateId: rate.id,
            mode: "Total",
            startedAt: onDate(row.occurredOn, row.startedAt),
            endedAt: onDate(row.occurredOn, row.endedAt),
            durationMinutes: minutes,
            occurredOn: row.occurredOn,
            description: row.notes || null,
            hourlyRate,
            inKindValue,
            sourceRef,
            createdAt: row.createdAt,
          },
        });
      } catch (error) {
        throw new Error(
          `Row ${row.sheetRow} failed (${row.hours}h, ${minutes}m, rate ${hourlyRate}, in-kind ${inKindValue}, start ${onDate(row.occurredOn, row.startedAt)?.toISOString() ?? "none"}, end ${onDate(row.occurredOn, row.endedAt)?.toISOString() ?? "none"}): ${error instanceof Error ? error.message : error}`,
        );
      }
      if (row.tags.length) {
        await db.userTimeEntryTag.createMany({
          data: row.tags.map((name) => ({ userTimeEntryId: entry.id, tagId: tags.get(name.toLowerCase())! })),
          skipDuplicates: true,
        });
      }

      created += 1;
    }

    const totals = await db.userTimeEntry.aggregate({
      where: { organizationId: organization.id, sourceRef: { startsWith: caswjSourceRefPrefix } },
      _count: { _all: true },
      _sum: { durationMinutes: true, inKindValue: true },
    });
    console.log(
      JSON.stringify(
        {
          appEnv,
          organizationId: organization.id,
          themeId: theme.id,
          themeName: theme.name,
          created,
          skipped,
          entries: totals._count._all,
          hours: Number((((totals._sum.durationMinutes ?? 0) / 60) as number).toFixed(5)),
          inKind: Number(totals._sum.inKindValue ?? 0),
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
