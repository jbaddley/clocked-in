/**
 * Download PDF for each standard report.
 */
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createOrgPerson, deleteMembershipByEmail, loginAs } from "./helpers";

const stamp = Date.now().toString(36);
const person = {
  firstName: "E2e",
  lastName: "Pdf",
  email: `e2e.pdf+${stamp}@example.com`,
  username: `e2epdf${stamp}`,
  password: "pdf-pass-99",
  role: "MEMBER" as const,
};

const standard = ["summary", "people", "group-sessions", "staff"] as const;
const outDir = path.join(process.cwd(), "docs/examples/reports");

test.afterAll(async ({ request }) => {
  await deleteMembershipByEmail(request, person.email);
});

test("staff can download a PDF of each standard report", async ({ page, request }) => {
  test.setTimeout(180_000);
  await mkdir(outDir, { recursive: true });
  await createOrgPerson(request, person);
  await loginAs(page, person.username, person.password);

  for (const slug of standard) {
    await page.goto(`/reports/${slug}`);
    await expect(page.getByRole("button", { name: "Reports menu" })).toBeVisible();
    await page.getByRole("button", { name: "Reports menu" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Download PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(new RegExp(`^${slug}-.+\\.pdf$`));
    const dest = path.join(outDir, download.suggestedFilename());
    await download.saveAs(dest);
    const header = await readFile(dest, { encoding: "utf8" });
    expect(header.slice(0, 5)).toBe("%PDF-");
  }
});
