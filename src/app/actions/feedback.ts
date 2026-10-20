"use server";

import {
  createFeedback,
  parseCreateFeedback,
  parseUpdateFeedback,
  updateFeedback,
} from "@/lib/api/features/feedback";
import { run } from "@/lib/server/action";
import { uploadFeedbackScreenshots } from "@/lib/server/feedback-assets";
import { requireAccess } from "@/lib/server/session";
import type { ActionResult } from "@/lib/types";

export async function createFeedbackAction(formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    const files = formData.getAll("screenshots").filter((item): item is File => item instanceof File && item.size > 0);
    const screenshotUrls = files.length > 0 ? await uploadFeedbackScreenshots(access.caller.id, files) : [];
    const organizationId = String(formData.get("organizationId") ?? "").trim();
    return createFeedback(
      access,
      parseCreateFeedback({
        type: String(formData.get("type") ?? ""),
        priority: String(formData.get("priority") ?? ""),
        area: String(formData.get("area") ?? ""),
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        screenshotUrls,
        ...(organizationId ? { organizationId } : {}),
      }),
    );
  }, "Thanks for the feedback.");
}

export async function updateFeedbackAction(input: {
  id: string;
  status: string;
  description: string;
  ticketUrl?: string;
}): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    return updateFeedback(
      access,
      input.id,
      parseUpdateFeedback({
        status: input.status,
        description: input.description,
        ...(input.ticketUrl ? { ticketUrl: input.ticketUrl } : {}),
      }),
    );
  }, "Feedback updated.");
}
