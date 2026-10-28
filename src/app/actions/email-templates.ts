"use server";

import {
  parseEmailTemplatePatch,
  resetEmailTemplate,
  updateEmailTemplate,
} from "@/lib/api/features/email-templates";
import { body, run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export async function updateEmailTemplateAction(
  organizationId: string,
  templateId: string,
  input: { name?: string; subject?: string; heading?: string; preview?: string; template?: string; isEnabled?: boolean },
) {
  return run(async () => {
    const access = await requireAccess();
    return updateEmailTemplate(access, organizationId, templateId, parseEmailTemplatePatch(body(input)));
  }, "Email template saved.");
}

export async function resetEmailTemplateAction(organizationId: string, templateId: string) {
  return run(async () => {
    const access = await requireAccess();
    return resetEmailTemplate(access, organizationId, templateId);
  }, "Email template reset to the default.");
}
