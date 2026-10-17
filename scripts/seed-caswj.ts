import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import ExcelJS from "exceljs";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const clockedInThemeId = "44444444-4444-4444-8444-444444444441";
const orgName = "CASWJ";
const workbookPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/base/Volunteer Hours.xlsx");
const departmentNames = [
  "Literary Arts Society",
  "Sugar Factory Playhouse",
  "Visual Arts Society",
  "West Jordan Community Band",
  "West Jordan Jazz Band",
  "West Jordan Symphony",
  "West Jordan Winds",
  "West Jordan Youth Theatre",
];
const caswjLabels = {
  organization: "Organization",
  project: "Project / Event",
  department: "Group",
  taskCategory: "Task Category",
};

function cell(value: ExcelJS.CellValue): unknown {
  if (value == null) {
    return null;
  }

  if (typeof value === "object" && "result" in value) {
    return cell(value.result as ExcelJS.CellValue);
  }

  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }

  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }

  return value;
}

function text(value: unknown) {
  if (value == null) {
    return "";
  }

  return String(value).trim();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

function localEmail(username: string) {
  return `${username}+caswj@clocked-in.local`;
}

function onDate(occurredOn: Date, clock: Date | null) {
  if (!clock) {
    return null;
  }

  return new Date(
    Date.UTC(occurredOn.getUTCFullYear(), occurredOn.getUTCMonth(), occurredOn.getUTCDate(), clock.getUTCHours(), clock.getUTCMinutes(), 0, 0),
  );
}

function asDate(value: unknown) {
  return value instanceof Date ? value : null;
}

function cents(value: number) {
  return Math.round(Number(`${value}e2`));
}

function money(value: number) {
  return cents(value) / 100;
}

function inKindFromMinutes(durationMinutes: number, hourlyRate: number) {
  return Math.round((durationMinutes * cents(hourlyRate)) / 60) / 100;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function prismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function main() {
  const password = process.env.SEED_SUPERADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("SEED_SUPERADMIN_PASSWORD is required.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const lists = workbook.getWorksheet("Lists & Settings");
  const volunteersSheet = workbook.getWorksheet("Volunteers");
  const log = workbook.getWorksheet("Volunteer Log");
  if (!lists || !volunteersSheet || !log) {
    throw new Error("Volunteer Hours.xlsx is missing Lists & Settings, Volunteers, or Volunteer Log.");
  }

  const categories = new Set<string>();
  const projectTitles = new Set<string>(["General / No Specific Project"]);
  lists.eachRow((row, number) => {
    if (number >= 2 && number <= 5) {
      const category = text(cell(row.getCell(7).value));
      if (category) {
        categories.add(category);
      }
    }

    if (number >= 21) {
      const title = text(cell(row.getCell(1).value));
      if (title && title !== "Project / Event") {
        projectTitles.add(title);
      }
    }
  });

  const people = new Map<
    string,
    { firstName: string; lastName: string; displayName: string; memberNumber: string; active: boolean; email?: string }
  >();
  volunteersSheet.eachRow((row, number) => {
    if (number === 1) {
      return;
    }

    const firstName = text(cell(row.getCell(2).value));
    const lastName = text(cell(row.getCell(3).value));
    if (!firstName && !lastName) {
      return;
    }

    const displayName = text(cell(row.getCell(4).value)) || `${firstName} ${lastName}`.trim();
    const memberNumber = text(cell(row.getCell(1).value)).padStart(3, "0");
    people.set(displayName.toLowerCase(), {
      firstName,
      lastName,
      displayName,
      memberNumber,
      active: text(cell(row.getCell(8).value)).toLowerCase() !== "no",
    });
  });

  type LogRow = {
    sheetRow: number;
    occurredOn: Date;
    project: string;
    volunteer: string;
    group: string;
    category: string;
    startedAt: Date | null;
    endedAt: Date | null;
    hours: number;
    rateType: string;
    hourlyRate: number;
    inKind: number;
    tags: string[];
    enteredBy: string;
    createdAt: Date;
    notes: string;
    volunteerId: string;
  };
  const logRows: LogRow[] = [];
  log.eachRow((row, number) => {
    if (number === 1) {
      return;
    }

    const occurredOn = asDate(cell(row.getCell(1).value));
    if (!occurredOn) {
      return;
    }

    const volunteer = text(cell(row.getCell(3).value));
    const project = text(cell(row.getCell(2).value)) || "General / No Specific Project";
    const category = text(cell(row.getCell(5).value));
    const hours = asNumber(cell(row.getCell(10).value));
    if (!category || hours == null) {
      return;
    }

    projectTitles.add(project);
    categories.add(category);
    if (volunteer && !people.has(volunteer.toLowerCase())) {
      people.set(volunteer.toLowerCase(), {
        firstName: volunteer.split(/\s+/)[0] ?? volunteer,
        lastName: volunteer.split(/\s+/).slice(1).join(" "),
        displayName: volunteer,
        memberNumber: "",
        active: true,
      });
    }

    logRows.push({
      sheetRow: number,
      occurredOn,
      project,
      volunteer,
      group: text(cell(row.getCell(4).value)),
      category,
      startedAt: asDate(cell(row.getCell(7).value)),
      endedAt: asDate(cell(row.getCell(8).value)),
      hours,
      rateType: text(cell(row.getCell(11).value)),
      hourlyRate: asNumber(cell(row.getCell(12).value)) ?? 0,
      inKind: asNumber(cell(row.getCell(13).value)) ?? 0,
      tags: text(cell(row.getCell(14).value))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      enteredBy: text(cell(row.getCell(15).value)),
      createdAt: asDate(cell(row.getCell(16).value)) ?? occurredOn,
      notes: text(cell(row.getCell(18).value)),
      volunteerId: text(cell(row.getCell(19).value)),
    });
  });

  if (![...people.values()].some((person) => person.displayName.toLowerCase() === "clockify import")) {
    people.set("clockify import", {
      firstName: "Clockify",
      lastName: "Import",
      displayName: "Clockify Import",
      memberNumber: "",
      active: false,
    });
  }

  let nextMember = Math.max(0, ...[...people.values()].map((person) => Number(person.memberNumber) || 0));
  for (const person of people.values()) {
    if (!person.memberNumber) {
      nextMember += 1;
      person.memberNumber = String(nextMember).padStart(3, "0");
    }
  }

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
    await db.organization.update({
      where: { id: organization.id },
      data: {
        rateSourceYear: 2025,
        defaultRateType: "Volunteer",
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
      const sourceRef = `caswj-log:${row.sheetRow}`;
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
      where: { organizationId: organization.id, sourceRef: { startsWith: "caswj-log:" } },
      _count: { _all: true },
      _sum: { durationMinutes: true, inKindValue: true },
    });
    console.log(
      JSON.stringify(
        {
          organizationId: organization.id,
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
