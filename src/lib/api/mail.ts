import catalog from "../../../emails/dist/messages.json";
import { fillTemplate, type EmailTemplate } from "@/lib/api/email-template";
import { fail } from "@/lib/api/errors";

const templates: Record<string, EmailTemplate> = catalog;

export async function sendEmail(to: string, template: string, variables: Record<string, string>) {
  const message = templates[template];
  if (!message) {
    throw new Error(`Unknown email template ${template}.`);
  }

  const filled = fillTemplate(message, variables);
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const url = process.env.RESEND_API_URL || "https://api.resend.com/emails";
  if (!apiKey || !from) {
    fail(502, "email_failed", "Email is not configured.");
  }

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
