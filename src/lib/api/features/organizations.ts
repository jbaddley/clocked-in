import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard, transaction, type Db } from "@/lib/api/db";
import { conflict, notFound, validation } from "@/lib/api/errors";
import { parseGuid } from "@/lib/api/guid";
import {
    Body,
    has,
    ids,
    limited,
    list,
    normalizeRateType,
    optional,
    optionalString,
    Optional,
    page,
    RateType,
    requireBool,
    requireDecimal,
    requireName,
    requireString,
    roundMoney,
} from "@/lib/api/json";
import { defaultVolunteerRate } from "@/lib/api/features/hourly-rates";
import { roleId } from "@/lib/api/features/memberships";
import { clockedInThemeId, themeJson, type ThemeJson } from "@/lib/api/features/themes";
import { defaultEntityLabels, type EntityLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export type OrganizationPreferences = {
  allowTimeEntryEditing: boolean;
  allowVolunteersToAddVolunteers: boolean;
  entityLabels: EntityLabels;
  feedbackNotifyUserIds: string[];
};

const themeInclude = { theme: true } as const;

function labelValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export function readPreferences(value: Prisma.JsonValue | null | undefined): OrganizationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      allowTimeEntryEditing: false,
      allowVolunteersToAddVolunteers: false,
      entityLabels: defaultEntityLabels,
      feedbackNotifyUserIds: [],
    };
  }

  const record = value as Record<string, unknown>;
  const labels = record.entityLabels;
  const source = labels && typeof labels === "object" && !Array.isArray(labels) ? (labels as Record<string, unknown>) : {};
  return {
    allowTimeEntryEditing: record.allowTimeEntryEditing === true,
    allowVolunteersToAddVolunteers: record.allowVolunteersToAddVolunteers === true,
    entityLabels: {
      organization: labelValue(source.organization, defaultEntityLabels.organization),
      project: labelValue(source.project, defaultEntityLabels.project),
      department: labelValue(source.department, defaultEntityLabels.department),
      taskCategory: labelValue(source.taskCategory, defaultEntityLabels.taskCategory),
    },
    feedbackNotifyUserIds: readNotifyUserIds(record.feedbackNotifyUserIds),
  };
}

function readNotifyUserIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? parseGuid(item) : null))
    .filter((item): item is string => item !== null);
}

function preferenceRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.InputJsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, Prisma.InputJsonValue>) };
}

function parseEntityLabels(value: unknown): EntityLabels {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    validation("entityLabels must be an object.");
  }

  const body = value as Body;
  const read = (key: keyof EntityLabels) => {
    const text = requireString(body, key).trim();
    if (text.length < 1 || text.length > 40) {
      validation(`${key} must be 1 to 40 characters.`);
    }

    return text;
  };

  return {
    organization: read("organization"),
    project: read("project"),
    department: read("department"),
    taskCategory: read("taskCategory"),
  };
}

function parsePreferences(value: unknown): OrganizationPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    validation("preferences must be an object.");
  }

  const body = value as Body;
  return {
    allowTimeEntryEditing: requireBool(body, "allowTimeEntryEditing"),
    allowVolunteersToAddVolunteers: has(body, "allowVolunteersToAddVolunteers")
      ? requireBool(body, "allowVolunteersToAddVolunteers")
      : false,
    entityLabels: has(body, "entityLabels") ? parseEntityLabels(body.entityLabels) : defaultEntityLabels,
    feedbackNotifyUserIds: has(body, "feedbackNotifyUserIds")
      ? [...new Set(ids(body, "feedbackNotifyUserIds", false))]
      : [],
  };
}

function brandUrl(body: Body, key: string) {
  if (!has(body, key) || body[key] === null) {
    return null;
  }

  const value = requireString(body, key);
  if (value.length > 2000) {
    validation(`${key} must be a URL.`);
  }

  return value;
}

export function organizationJson(
  organization: {
    id: string;
    name: string;
    defaultRateType: string;
    preferences?: Prisma.JsonValue | null;
    themeId: string;
    theme: Parameters<typeof themeJson>[0];
    wordmarkUrl: string | null;
    wordmarkOnLightUrl: string | null;
    markUrl: string | null;
    accentImageUrl: string | null;
    description: string | null;
    websiteUrl: string | null;
    publicSlug?: string | null;
  },
  volunteerHourlyRate: number,
) {
  return {
    id: organization.id,
    name: organization.name,
    volunteerHourlyRate,
    defaultRateType: organization.defaultRateType,
    preferences: readPreferences(organization.preferences),
    themeId: organization.themeId,
    theme: themeJson(organization.theme),
    wordmarkUrl: organization.wordmarkUrl,
    wordmarkOnLightUrl: organization.wordmarkOnLightUrl,
    markUrl: organization.markUrl,
    accentImageUrl: organization.accentImageUrl,
    description: organization.description,
    websiteUrl: organization.websiteUrl,
    publicSlug: organization.publicSlug ?? null,
  };
}

export type NameRequest = { name: string };

export function parseName(body: Body): NameRequest {
  return { name: requireName(requireString(body, "name")) };
}

export type UpdateOrganizationRequest = {
  name: Optional<string>;
  volunteerHourlyRate: Optional<number>;
  defaultRateType: Optional<RateType>;
  preferences: Optional<OrganizationPreferences>;
  themeId: Optional<string>;
  wordmarkUrl: Optional<string | null>;
  wordmarkOnLightUrl: Optional<string | null>;
  markUrl: Optional<string | null>;
  accentImageUrl: Optional<string | null>;
  description: Optional<string | null>;
  websiteUrl: Optional<string | null>;
  publicSlug: Optional<string | null>;
};

export function parseUpdateOrganization(body: Body): UpdateOrganizationRequest {
  const request: UpdateOrganizationRequest = {
    name: optional(body, "name", (b, k) => requireName(requireString(b, k))),
    volunteerHourlyRate: optional(body, "volunteerHourlyRate", (b, k) => {
      const rate = requireDecimal(b, k);
      if (rate <= 0) {
        validation("volunteerHourlyRate must be greater than zero.");
      }

      return roundMoney(rate);
    }),
    defaultRateType: optional(body, "defaultRateType", (b, k) => normalizeRateType(requireString(b, k))),
    preferences: optional(body, "preferences", (b, k) => parsePreferences(b[k])),
    themeId: optional(body, "themeId", (b, k) => requireString(b, k)),
    wordmarkUrl: optional(body, "wordmarkUrl", brandUrl),
    wordmarkOnLightUrl: optional(body, "wordmarkOnLightUrl", brandUrl),
    markUrl: optional(body, "markUrl", brandUrl),
    accentImageUrl: optional(body, "accentImageUrl", brandUrl),
    description: optional(body, "description", (b, k) => limited(b, k, 8000, "description must be 8000 characters or fewer.")),
    websiteUrl: optional(body, "websiteUrl", (b, k) => limited(b, k, 2000, "websiteUrl must be a URL.")),
    publicSlug: optional(body, "publicSlug", (b, k) => {
      const value = optionalString(b, k);
      if (!value) return null;
      const slug = value.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) {
        validation("publicSlug must be 2 to 48 letters, numbers, or hyphens.");
      }
      return slug;
    }),
  };
  if (
    !request.name.set &&
    !request.volunteerHourlyRate.set &&
    !request.defaultRateType.set &&
    !request.preferences.set &&
    !request.themeId.set &&
    !request.wordmarkUrl.set &&
    !request.wordmarkOnLightUrl.set &&
    !request.markUrl.set &&
    !request.accentImageUrl.set &&
    !request.description.set &&
    !request.websiteUrl.set &&
    !request.publicSlug.set
  ) {
    validation("Provide at least one field to update.");
  }

  return request;
}

export async function createOrganization(access: Access, request: NameRequest) {
  const caller = access.requireHuman();
  const adminRoleId = await roleId("ADMIN");
  const organization = await guard(
    prisma.organization.create({
      data: {
        name: request.name,
        defaultRateType: "Volunteer",
        themeId: clockedInThemeId,
        hourlyRates: { create: { type: "Volunteer", name: "Volunteer", perHourRate: 35.47, isDefault: true } },
        memberships: {
          create: { userId: caller.id, roleId: adminRoleId, rateType: "Volunteer", isActive: true },
        },
      },
      include: themeInclude,
    }),
  );
  return organizationJson(organization, 35.47);
}

export async function listOrganizations(access: Access, params: URLSearchParams) {
  const paging = page(params);
  const where = access.isApiKey
    ? { id: { in: await access.activeOrganizationIds() } }
    : access.isSuperAdmin
      ? {}
      : { memberships: { some: { userId: access.actorUserId, isActive: true } } };
  const organizations = await prisma.organization.findMany({
    where,
    include: { ...themeInclude, hourlyRates: { where: { isDefault: true }, take: 1 } },
    orderBy: { name: "asc" },
    skip: paging.offset,
    take: paging.limit,
  });
  return list(
    organizations.map((organization) =>
      organizationJson(organization, Number(organization.hourlyRates[0]?.perHourRate ?? 35.47)),
    ),
    paging,
  );
}

export async function getOrganization(access: Access, organizationId: string) {
  const organization = await access.requireOrganization(organizationId, false);
  return organizationJson(organization, (await defaultVolunteerRate(organizationId)).rate);
}

export async function updateOrganization(access: Access, organizationId: string, request: UpdateOrganizationRequest) {
  await access.requireOrganizationAdmin(organizationId);
  const organization = await transaction(async (tx) => {
    const current = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { preferences: true },
    });
    if (request.themeId.set) {
      const theme = await tx.theme.findFirst({
        where: { id: request.themeId.value, OR: [{ organizationId: null }, { organizationId }] },
      });
      if (!theme) {
        notFound();
      }
    }

    if (request.preferences.set) {
      await assertNotifyUsers(tx, organizationId, request.preferences.value.feedbackNotifyUserIds);
    }

    const nextPreferences = request.preferences.set
      ? {
          ...preferenceRecord(current.preferences),
          allowTimeEntryEditing: request.preferences.value.allowTimeEntryEditing,
          allowVolunteersToAddVolunteers: request.preferences.value.allowVolunteersToAddVolunteers,
          entityLabels: request.preferences.value.entityLabels,
          feedbackNotifyUserIds: request.preferences.value.feedbackNotifyUserIds,
        }
      : undefined;
    await tx.organization.update({
      where: { id: organizationId },
      data: {
        name: request.name.set ? request.name.value : undefined,
        defaultRateType: request.defaultRateType.set ? request.defaultRateType.value : undefined,
        themeId: request.themeId.set ? request.themeId.value : undefined,
        wordmarkUrl: request.wordmarkUrl.set ? request.wordmarkUrl.value : undefined,
        wordmarkOnLightUrl: request.wordmarkOnLightUrl.set ? request.wordmarkOnLightUrl.value : undefined,
        markUrl: request.markUrl.set ? request.markUrl.value : undefined,
        accentImageUrl: request.accentImageUrl.set ? request.accentImageUrl.value : undefined,
        description: request.description.set ? request.description.value : undefined,
        websiteUrl: request.websiteUrl.set ? request.websiteUrl.value : undefined,
        publicSlug: request.publicSlug.set ? request.publicSlug.value : undefined,
        preferences: nextPreferences,
      },
    });
    if (request.volunteerHourlyRate.set) {
      const updated = await tx.hourlyRate.updateMany({
        where: { organizationId, isDefault: true },
        data: { perHourRate: request.volunteerHourlyRate.value },
      });
      if (updated.count === 0) {
        await tx.hourlyRate.create({
          data: {
            organizationId,
            type: "Volunteer",
            name: "Volunteer",
            perHourRate: request.volunteerHourlyRate.value,
            isDefault: true,
          },
        });
      }
    }

    return tx.organization.findUniqueOrThrow({ where: { id: organizationId }, include: themeInclude });
  });
  return organizationJson(organization, (await defaultVolunteerRate(organizationId)).rate);
}

async function assertNotifyUsers(db: Db, organizationId: string, userIds: string[]) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) {
    return;
  }

  const active = await db.organizationMembership.count({
    where: { organizationId, isActive: true, userId: { in: unique } },
  });
  if (active !== unique.length) {
    validation("feedbackNotifyUserIds must be active users in this organization.");
  }
}

export async function deleteOrganization(access: Access, organizationId: string) {
  access.requireHuman();
  await access.requireOrganizationAdmin(organizationId);
  const referenced =
    (await prisma.userTimeEntry.count({ where: { organizationId } })) > 0 ||
    (await prisma.collectiveTimeEntry.count({ where: { organizationId } })) > 0;
  if (referenced) {
    conflict("Delete the time entries first.");
  }

  await guard(prisma.organization.delete({ where: { id: organizationId } }));
}

export type { ThemeJson };
