import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { emailTemplateDefaults } from "./defaults";
import {
  emailTemplateFields,
  isEmailTemplateFor,
  placeholdersIn,
  sanitizeEmailHtml,
  unknownPlaceholders,
} from "../src/lib/email/templates";

const codeLine = /Use this code to (?:reset your VolunTime password|accept the invite):<\/p><p>\{\{(?:invite|reset)\.code\}\}<\/p>/;

async function main() {
  const defaults = emailTemplateDefaults.map((item) => {
    if (!isEmailTemplateFor(item.for)) throw new Error(`Unknown email template for ${item.for}.`);
    if (sanitizeEmailHtml(item.html) !== item.html) throw new Error(`Default ${item.for} html is not sanitized.`);
    const unknown = unknownPlaceholders(item.for, item.subject, item.heading, item.preview, item.html);
    if (unknown.length > 0) throw new Error(`Default ${item.for} uses unknown fields ${unknown.join(", ")}.`);
    if ((item.for === "Invite" || item.for === "PasswordReset") && !codeLine.test(item.html)) {
      throw new Error(`Default ${item.for} must keep the mailed code line.`);
    }
    return { ...item, variables: placeholdersIn(item.subject, item.heading, item.preview, item.html) };
  });
  const missing = Object.keys(emailTemplateFields).filter((key) => !defaults.some((item) => item.for === key));
  if (missing.length > 0) throw new Error(`Missing email template defaults for ${missing.join(", ")}.`);

  const directory = path.dirname(fileURLToPath(import.meta.url));
  const destination = path.join(directory, "dist", "defaults.json");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(defaults, null, 2)}\n`);
  console.log(`Wrote ${destination}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
