/**
 * Admin configures when emails are sent on /settings/email.
 * Local seed only — skipped in prod.
 */
import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe.configure({ mode: "serial" });

test("admin updates email send settings on /settings/email and sees updated template badges", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/settings/email");

  await expect(page.getByText("When emails are sent")).toBeVisible();
  await expect(page.getByText("Email Templates")).toBeVisible();

  await page.getByLabel("Hours logged frequency").click();
  await page.getByRole("option", { name: "Weekly digest" }).last().click();

  await page.getByLabel("Unclassified time frequency").click();
  await page.getByRole("option", { name: "Off" }).last().click();

  await page.getByRole("button", { name: "Save email settings" }).click();
  await expect(page.getByRole("status")).toContainText("Email settings saved.");

  const templatesList = page.locator("ul.divide-y");
  await expect(templatesList.locator("li", { hasText: "Hours logged" })).toContainText("Weekly digest");
  await expect(templatesList.locator("li", { hasText: "Unclassified time" })).toContainText("Off");

  await page.getByLabel("Hours logged frequency").click();
  await page.getByRole("option", { name: "Immediately" }).last().click();

  await page.getByLabel("Unclassified time frequency").click();
  await page.getByRole("option", { name: "Immediately" }).last().click();

  await page.getByRole("button", { name: "Save email settings" }).click();
  await expect(page.getByRole("status")).toContainText("Email settings saved.");
  await expect(templatesList.locator("li", { hasText: "Hours logged" })).toContainText("Immediately");
  await expect(templatesList.locator("li", { hasText: "Unclassified time" })).toContainText("Immediately");
});
