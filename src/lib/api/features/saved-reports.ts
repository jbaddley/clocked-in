import { Prisma } from "@/generated/prisma/client";
import { Access } from "@/lib/api/access";
import { guard, lockOrganization, transaction } from "@/lib/api/db";
import { conflict, notFound, validation } from "@/lib/api/errors";
import { Body, has, list, page } from "@/lib/api/json";
import { report } from "@/lib/api/features/reports";
import { prisma } from "@/lib/prisma";
import {
  normalizeFilters,
  normalizeLayout,
  normalizeReportName,
  type ReportFilters,
  type ReportLayout,
} from "@/lib/report-layout";

type ReportRow = {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  isDashboard: boolean;
  layout: Prisma.JsonValue;
  filters: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

function readLayout(value: unknown) {
  try {
    return normalizeLayout(value);
  } catch (error) {
    validation(error instanceof Error ? error.message : "layout is invalid.");
  }
}

function readFilters(value: unknown) {
  try {
    return normalizeFilters(value);
  } catch (error) {
    validation(error instanceof Error ? error.message : "filters are invalid.");
  }
}

function readName(value: unknown) {
  try {
    return normalizeReportName(value);
  } catch (error) {
    validation(error instanceof Error ? error.message : "name is required.");
  }
}

function savedReportJson(row: ReportRow) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    isDefault: row.isDefault,
    isDashboard: row.isDashboard,
    layout: readLayout(row.layout),
    filters: readFilters(row.filters),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureNameAvailable(organizationId: string, name: string, exceptId?: string) {
  const taken = await prisma.report.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (taken) {
    conflict("A report with that name already exists.");
  }
}

export async function listSavedReports(access: Access, organizationId: string, params: URLSearchParams) {
  const paging = page(params);
  await access.requireOrganization(organizationId, false);
  const rows = await prisma.report.findMany({
    where: { organizationId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    skip: paging.offset,
    take: paging.limit,
  });
  return list(rows.map(savedReportJson), paging);
}

export async function getSavedReport(access: Access, organizationId: string, reportId: string) {
  await access.requireOrganization(organizationId, false);
  const row = await prisma.report.findFirst({ where: { id: reportId, organizationId } });
  if (!row) {
    notFound();
  }

  return savedReportJson(row);
}

export async function createSavedReport(access: Access, organizationId: string, body: Body) {
  await access.requireOrganization(organizationId, true);
  if (!has(body, "layout")) {
    validation("layout is required.");
  }

  const name = readName(body.name);
  const layout = readLayout(body.layout);
  const filters = readFilters(has(body, "filters") ? body.filters : {});
  const isDefault = body.isDefault === undefined ? false : body.isDefault;
  if (typeof isDefault !== "boolean") {
    validation("isDefault must be a boolean.");
  }

  const isDashboard = body.isDashboard === undefined ? false : body.isDashboard;
  if (typeof isDashboard !== "boolean") {
    validation("isDashboard must be a boolean.");
  }

  await ensureNameAvailable(organizationId, name);
  const now = new Date();
  const row = await transaction(async (tx) => {
    if (isDefault || isDashboard) {
      await lockOrganization(tx, organizationId);
    }
    if (isDefault) {
      await tx.report.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false, updatedAt: now },
      });
    }
    if (isDashboard) {
      await tx.report.updateMany({
        where: { organizationId, isDashboard: true },
        data: { isDashboard: false, updatedAt: now },
      });
    }

    return tx.report.create({
      data: {
        id: crypto.randomUUID(),
        organizationId,
        name,
        isDefault,
        isDashboard,
        layout,
        filters,
        createdAt: now,
        updatedAt: now,
      },
    });
  });
  return savedReportJson(row);
}

export async function updateSavedReport(access: Access, organizationId: string, reportId: string, body: Body) {
  await access.requireOrganization(organizationId, true);
  const current = await prisma.report.findFirst({ where: { id: reportId, organizationId } });
  if (!current) {
    notFound();
  }

  const name = has(body, "name") ? readName(body.name) : current.name;
  const layout = has(body, "layout") ? readLayout(body.layout) : readLayout(current.layout);
  const filters = has(body, "filters") ? readFilters(body.filters) : readFilters(current.filters);
  let isDefault = current.isDefault;
  if (has(body, "isDefault")) {
    if (typeof body.isDefault !== "boolean") {
      validation("isDefault must be a boolean.");
    }

    isDefault = body.isDefault;
  }

  let isDashboard = current.isDashboard;
  if (has(body, "isDashboard")) {
    if (typeof body.isDashboard !== "boolean") {
      validation("isDashboard must be a boolean.");
    }

    isDashboard = body.isDashboard;
  }

  if (has(body, "name")) {
    await ensureNameAvailable(organizationId, name, reportId);
  }

  const now = new Date();
  const row = await transaction(async (tx) => {
    if (isDefault || isDashboard) {
      await lockOrganization(tx, organizationId);
    }
    if (isDefault) {
      await tx.report.updateMany({
        where: { organizationId, isDefault: true, NOT: { id: reportId } },
        data: { isDefault: false, updatedAt: now },
      });
    }
    if (isDashboard) {
      await tx.report.updateMany({
        where: { organizationId, isDashboard: true, NOT: { id: reportId } },
        data: { isDashboard: false, updatedAt: now },
      });
    }

    return tx.report.update({
      where: { id: reportId },
      data: { name, isDefault, isDashboard, layout, filters, updatedAt: now },
    });
  });
  return savedReportJson(row);
}

export async function deleteSavedReport(access: Access, organizationId: string, reportId: string) {
  await access.requireOrganization(organizationId, true);
  const current = await prisma.report.findFirst({ where: { id: reportId, organizationId }, select: { id: true } });
  if (!current) {
    notFound();
  }

  await guard(prisma.report.delete({ where: { id: reportId } }));
}

function queryText(params: URLSearchParams, key: string) {
  const value = params.get(key);
  return value === null || value === "" ? undefined : value;
}

export async function savedReportData(access: Access, organizationId: string, reportId: string, params: URLSearchParams) {
  await access.requireOrganization(organizationId, false);
  const row = await prisma.report.findFirst({ where: { id: reportId, organizationId } });
  if (!row) {
    notFound();
  }

  const clearDates = params.get("clearDates");
  if (clearDates !== null && clearDates !== "true") {
    validation("clearDates must be true.");
  }

  const stored = readFilters(row.filters);
  const query = new URLSearchParams();
  const set = (key: keyof ReportFilters, value: string | undefined) => {
    if (value) {
      query.set(key, value);
    }
  };
  set("departmentId", stored.departmentId);
  set("taskCategoryId", stored.taskCategoryId);
  set("projectId", stored.projectId);
  set("userId", stored.userId);
  const from = queryText(params, "from");
  const to = queryText(params, "to");
  set("from", clearDates === "true" ? from : from ?? stored.from);
  set("to", clearDates === "true" ? to : to ?? stored.to);
  return report(access, organizationId, query);
}

export type SavedReport = {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  isDashboard: boolean;
  layout: ReportLayout;
  filters: ReportFilters;
  createdAt: string;
  updatedAt: string;
};
