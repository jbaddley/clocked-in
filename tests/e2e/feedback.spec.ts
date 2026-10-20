/**
 * SuperAdmin submits feedback from the header and triages it on /feedback.
 * Local seed only — skipped in prod.
 */
import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe.configure({ mode: "serial" });

test("submit feedback and update it from the SuperAdmin inbox", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Feedback" }).click();
  const dialog = page.getByRole("dialog", { name: "Send feedback" });
  await expect(dialog).toBeVisible();
  const title = `E2E timer ${Date.now().toString(36)}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Description").fill("The stop button did nothing.");
  await dialog.getByRole("button", { name: "Send feedback" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Thanks for the feedback.")).toBeVisible();

  await page.goto("/feedback");
  await expect(page.getByRole("tab", { name: "Active", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: title })).toBeVisible();
  await page.getByRole("row", { name: title }).getByRole("button", { name: "Update" }).click();
  const update = page.getByRole("dialog", { name: "Update feedback" });
  await expect(update).toBeVisible();
  await update.getByLabel("Status").click();
  await page.getByRole("option", { name: "Resolved" }).click();
  await update.getByLabel("Note").fill("Shipped in this build.");
  await update.getByRole("button", { name: "Save" }).click();
  await expect(update).toBeHidden();
  await page.getByRole("tab", { name: "Inactive", exact: true }).click();
  await expect(page.getByRole("cell", { name: title })).toBeVisible();
});
