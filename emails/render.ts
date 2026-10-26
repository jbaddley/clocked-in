import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@react-email/render";
import { createElement } from "react";
import AccountWelcomeEmail, { accountWelcome } from "./account-welcome";
import FeedbackCompletedEmail, { feedbackCompleted } from "./feedback-completed";
import FeedbackNotifyEmail, { feedbackNotify } from "./feedback-notify";
import FeedbackReceivedEmail, { feedbackReceived } from "./feedback-received";
import InvitationEmail, { invitation } from "./invitation";
import PasswordResetEmail, { passwordReset } from "./password-reset";
import VolunteerMessageEmail, { volunteerMessage } from "./volunteer-message";

const codeLine = /Use this code to (?:reset your VolunTime password|accept the invite):\s*\{\{code\}\}/;

const templates = [
  {
    ...accountWelcome,
    element: createElement(AccountWelcomeEmail, {
      organizationName: "{{organizationName}}",
      username: "{{username}}",
      password: "{{password}}",
      url: "{{url}}",
    }),
  },
  {
    ...passwordReset,
    element: createElement(PasswordResetEmail, { code: "{{code}}", url: "{{url}}" }),
  },
  {
    ...invitation,
    element: createElement(InvitationEmail, {
      targetKind: "{{targetKind}}",
      targetName: "{{targetName}}",
      roleName: "{{roleName}}",
      code: "{{code}}",
      url: "{{url}}",
    }),
  },
  {
    ...feedbackReceived,
    element: createElement(FeedbackReceivedEmail, {
      firstName: "{{firstName}}",
      title: "{{title}}",
      typeLabel: "{{typeLabel}}",
    }),
  },
  {
    ...feedbackNotify,
    element: createElement(FeedbackNotifyEmail, {
      submitterName: "{{submitterName}}",
      typeLabel: "{{typeLabel}}",
      priorityLabel: "{{priorityLabel}}",
      areaLabel: "{{areaLabel}}",
      title: "{{title}}",
      description: "{{description}}",
      url: "{{url}}",
    }),
  },
  {
    ...volunteerMessage,
    element: createElement(VolunteerMessageEmail, { body: "{{body}}", needName: "{{needName}}" }),
  },
  {
    ...feedbackCompleted,
    element: createElement(FeedbackCompletedEmail, {
      firstName: "{{firstName}}",
      title: "{{title}}",
      typeLabel: "{{typeLabel}}",
      outcome: "{{outcome}}",
      note: "{{note}}",
    }),
  },
];

async function main() {
  const messages: Record<string, { subject: string; html: string; text: string; variables: string[] }> = {};

  for (const template of templates) {
    const html = await render(template.element);
    const text = await render(template.element, { plainText: true });
    const rendered = `${template.subject}\n${html}\n${text}`;
    for (const name of template.variables) {
      if (!rendered.includes(`{{${name}}}`)) {
        throw new Error(`Template ${template.id} is missing {{${name}}}.`);
      }
    }

    if (template.variables.includes("code") && !codeLine.test(text)) {
      throw new Error(`Template ${template.id} plain text does not keep the code line.\n${text}`);
    }

    messages[template.id] = {
      subject: template.subject,
      html,
      text,
      variables: template.variables,
    };
  }

  const directory = path.dirname(fileURLToPath(import.meta.url));
  const destination = path.join(directory, "dist", "messages.json");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`Wrote ${destination}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
