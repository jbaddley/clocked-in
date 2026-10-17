import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@react-email/render";
import { createElement } from "react";
import InvitationEmail, { invitation } from "./invitation";
import PasswordResetEmail, { passwordReset } from "./password-reset";

const codeLine = /Use this code to (?:reset your Clocked In password|accept the invite):\s*\{\{code\}\}/;

const templates = [
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

    if (!codeLine.test(text)) {
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
