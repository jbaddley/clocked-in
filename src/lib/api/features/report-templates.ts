import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard } from "@/lib/api/db";
import { conflict, forbidden, notFound, validation } from "@/lib/api/errors";
import { Body, has, list, page } from "@/lib/api/json";
import { parseGuid } from "@/lib/api/guid";
import { readLayout, readName } from "@/lib/api/report-input";
import { prisma } from "@/lib/prisma";
import { reportTemplateIds, type ReportLayout } from "@/lib/report-layout";

const globalKeys = reportTemplateIds;

type TemplateRow = {
  id: string;
  organizationId: string | null;
  key: string | null;
  name: string;
  layout: Prisma.JsonValue;
  baseTemplateId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReportTemplate = {
  id: string;
  organizationId: string | null;
  key: string | null;
  name: string;
  layout: ReportLayout;
  baseTemplateId: string | null;
  scope: "global" | "organization" | "override";
  createdAt: string;
  updatedAt: string;
};

function describe(row: TemplateRow, globals: Map<string, TemplateRow>): ReportTemplate {
  const layout = readLayout(row.layout);
  const scope = row.organizationId === null ? "global" : row.baseTemplateId ? "override" : "organization";
  const key = row.baseTemplateId ? globals.get(row.baseTemplateId)?.key ?? null : row.key;
  return {
    id: row.id,
    organizationId: row.organizationId,
    key,
    name: row.name,
    layout,
    baseTemplateId: row.baseTemplateId,
    scope,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function resolve(rows: TemplateRow[]) {
  const globals = new Map(rows.filter((row) => row.organizationId === null).map((row) => [row.id, row]));
  const overrides = new Map(
    rows.filter((row) => row.baseTemplateId).map((row) => [row.baseTemplateId as string, row]),
  );
  const resolved: ReportTemplate[] = [];
  for (const key of globalKeys) {
    const global = rows.find((row) => row.organizationId === null && row.key === key);
    if (!global) continue;
    const replacement = overrides.get(global.id);
    resolved.push(describe(replacement ?? global, globals));
  }

  for (const owned of rows
    .filter((row) => row.organizationId !== null && row.baseTemplateId === null)
    .sort((left, right) => left.name.localeCompare(right.name) || left.createdAt.getTime() - right.createdAt.getTime())) {
    resolved.push(describe(owned, globals));
  }

  return resolved;
}

async function visible(organizationId: string) {
  return prisma.reportTemplate.findMany({
    where: { OR: [{ organizationId: null }, { organizationId }] },
  });
}

async function ensureOrganizationName(organizationId: string, name: string, exceptId?: string) {
  const taken = await prisma.reportTemplate.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (taken) conflict("A template with that name already exists.");
}

async function ensureGlobalName(name: string, exceptId: string) {
  const taken = await prisma.reportTemplate.findFirst({
    where: {
      organizationId: null,
      name: { equals: name, mode: "insensitive" },
      NOT: { id: exceptId },
    },
    select: { id: true },
  });
  if (taken) conflict("A template with that name already exists.");
}

export async function listReportTemplates(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const resolved = resolve(await visible(organizationId));
  return list(resolved.slice(paging.offset, paging.offset + paging.limit), paging);
}

export async function getReportTemplate(access: Access, organizationId: string, templateId: string) {
  await access.requireOrganization(organizationId, false);
  const rows = await visible(organizationId);
  const row = rows.find((item) => item.id === templateId);
  if (!row) notFound();
  return describe(row, new Map(rows.filter((item) => item.organizationId === null).map((item) => [item.id, item])));
}

export async function createReportTemplate(access: Access, organizationId: string, body: Body) {
  await access.requireReportDesigner(organizationId);
  if (!has(body, "layout")) validation("layout is required.");
  const layout = readLayout(body.layout);
  const now = new Date();
  if (has(body, "baseTemplateId") && body.baseTemplateId !== null) {
    const baseTemplateId = typeof body.baseTemplateId === "string" ? parseGuid(body.baseTemplateId) : null;
    if (!baseTemplateId) validation("baseTemplateId must be an id.");
    const global = await prisma.reportTemplate.findFirst({ where: { id: baseTemplateId, organizationId: null } });
    if (!global) validation("baseTemplateId must be a global template.");
    const name = has(body, "name") && body.name !== null ? readName(body.name) : global.name;
    const existing = await prisma.reportTemplate.findFirst({ where: { organizationId, baseTemplateId } });
    if (existing) {
      await ensureOrganizationName(organizationId, name, existing.id);
      const row = await guard(
        prisma.reportTemplate.update({
          where: { id: existing.id },
          data: { name, layout, updatedAt: now },
        }),
      );
      return describe(row, new Map([[global.id, global]]));
    }

    await ensureOrganizationName(organizationId, name);
    const row = await guard(
      prisma.reportTemplate.create({
        data: {
          id: crypto.randomUUID(),
          organizationId,
          name,
          layout,
          baseTemplateId,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    return describe(row, new Map([[global.id, global]]));
  }

  const name = readName(body.name);
  await ensureOrganizationName(organizationId, name);
  const row = await guard(
    prisma.reportTemplate.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        name,
        layout,
        createdAt: now,
        updatedAt: now,
      },
    }),
  );
  return describe(row, new Map());
}

export async function updateReportTemplate(access: Access, organizationId: string, templateId: string, body: Body) {
  await access.requireOrganization(organizationId, false);
  const current = await prisma.reportTemplate.findUnique({ where: { id: templateId } });
  if (!current || (current.organizationId !== null && current.organizationId !== organizationId)) notFound();
  if (current.organizationId === null) {
    if (!access.isSuperAdmin) forbidden();
  } else {
    await access.requireReportDesigner(organizationId);
  }

  if (has(body, "baseTemplateId")) validation("baseTemplateId cannot be changed.");
  const name = has(body, "name") ? readName(body.name) : current.name;
  const layout = has(body, "layout") ? readLayout(body.layout) : readLayout(current.layout);
  if (has(body, "name")) {
    if (current.organizationId === null) await ensureGlobalName(name, current.id);
    else await ensureOrganizationName(organizationId, name, current.id);
  }

  const row = await guard(
    prisma.reportTemplate.update({
      where: { id: current.id },
      data: { name, layout, updatedAt: new Date() },
    }),
  );
  const globals = await prisma.reportTemplate.findMany({ where: { organizationId: null } });
  return describe(row, new Map(globals.map((item) => [item.id, item])));
}

export async function deleteReportTemplate(access: Access, organizationId: string, templateId: string) {
  await access.requireOrganization(organizationId, false);
  const current = await prisma.reportTemplate.findUnique({ where: { id: templateId } });
  if (!current || (current.organizationId !== null && current.organizationId !== organizationId)) notFound();
  if (current.organizationId === null) forbidden();
  await access.requireReportDesigner(organizationId);
  await guard(prisma.reportTemplate.delete({ where: { id: templateId } }));
}
