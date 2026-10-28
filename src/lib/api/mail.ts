import defaults from "../../../emails/dist/defaults.json";
import { fail } from "@/lib/api/errors";
import { prisma } from "@/lib/prisma";
import {
  optionalEmailTemplates,
  renderEmail,
  type EmailContext,
  type EmailTemplateContent,
  type EmailTemplateFor,
} from "@/lib/email/templates";

export type EmailTemplateDefault = (typeof defaults)[number] & { for: EmailTemplateFor };

export const emailTemplateDefaults = defaults as EmailTemplateDefault[];

export function emailTemplateDefault(kind: EmailTemplateFor) {
  const item = emailTemplateDefaults.find((entry) => entry.for === kind);
  if (!item) {
    throw new Error(`No default email template for ${kind}.`);
  }
  return item;
}

/** The organization's saved copy, or the default when there is none. Null when an optional mail is off. */
async function templateFor(organizationId: string | null, kind: EmailTemplateFor): Promise<EmailTemplateContent | null> {
  const fallback = emailTemplateDefault(kind);
  const content = { subject: fallback.subject, heading: fallback.heading, preview: fallback.preview, template: fallback.html };
  if (!organizationId) {
    return content;
  }

  const row = await prisma.emailTemplate.findUnique({
    where: { organizationId_for: { organizationId, for: kind } },
  });
  if (!row) {
    return content;
  }

  if (!row.isEnabled && optionalEmailTemplates.includes(kind)) {
    return null;
  }

  return { subject: row.subject, heading: row.heading, preview: row.preview, template: row.template };
}

export async function sendEmail({
  to,
  organizationId,
  for: kind,
  context,
}: {
  to: string;
  organizationId: string | null;
  for: EmailTemplateFor;
  context: EmailContext;
}) {
  const content = await templateFor(organizationId, kind);
  if (!content) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const url = process.env.RESEND_API_URL || "https://api.resend.com/emails";
  if (!apiKey || !from) {
    fail(502, "email_failed", "Email is not configured.");
  }

  const filled = renderEmail(content, context);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: filled.subject,
        html: filled.html,
        text: filled.text,
      }),
    });
  } catch {
    fail(502, "email_failed", "The email could not be sent.");
  }

  if (!response.ok) {
    fail(502, "email_failed", "The email could not be sent.");
  }
}
