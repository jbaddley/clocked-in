"use server";

import { createReportTemplate, updateReportTemplate } from "@/lib/api/features/report-templates";
import { createSavedReport, updateSavedReport } from "@/lib/api/features/saved-reports";
import { run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export async function createReportAction(organizationId: string, body: Record<string, unknown>) {
  return run(async () => createSavedReport(await requireAccess(), organizationId, body));
}

export async function updateReportAction(organizationId: string, reportId: string, body: Record<string, unknown>) {
  return run(async () => updateSavedReport(await requireAccess(), organizationId, reportId, body));
}

export async function createReportTemplateAction(organizationId: string, body: Record<string, unknown>) {
  return run(async () => createReportTemplate(await requireAccess(), organizationId, body));
}

export async function updateReportTemplateAction(organizationId: string, templateId: string, body: Record<string, unknown>) {
  return run(async () => updateReportTemplate(await requireAccess(), organizationId, templateId, body));
}
