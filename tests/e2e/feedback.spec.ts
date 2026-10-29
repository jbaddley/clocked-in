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
  await expect(dialog.getByLabel("Area")).toContainText("Dashboard");
  const title = `E2E timer ${Date.now().toString(36)}`;
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByLabel("Description").fill("The stop button did nothing.");
  await dialog.getByRole("button", { name: "Send feedback" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Thanks for the feedback.")).toBeVisible();

  await page.goto("/feedback");
  await expect(page.getByRole("tab", { name: "Active", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: title })).toBeVisible();
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("The stop button did nothing.", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Status").click();
  await page.getByRole("option", { name: "Resolved" }).click();
  await page.getByLabel("Note").fill("Shipped in this build.");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("Pending to Resolved")).toBeVisible();
  await page.getByRole("link", { name: "All feedback" }).click();
  await page.getByRole("tab", { name: "Inactive", exact: true }).click();
  await expect(page.getByRole("cell", { name: title })).toBeVisible();
});
