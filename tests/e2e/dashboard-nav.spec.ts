/**
 * Dashboard cards open the entries behind them.
 */
import { expect, test } from "@playwright/test";
import { createOrgPerson, deleteMembershipByEmail, loginAs } from "./helpers";

const stamp = Date.now().toString(36);
const person = {
  firstName: "E2e",
  lastName: "Dash",
  email: `e2e.dash+${stamp}@example.com`,
  username: `e2edash${stamp}`,
  password: "dash-pass-99",
};

test.afterAll(async ({ request }) => {
  await deleteMembershipByEmail(request, person.email);
});

test("volunteer hours card opens entries", async ({ page, request }) => {
  await createOrgPerson(request, person);
  await loginAs(page, person.username, person.password);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /volunteer hours/i }).first().click();
  await expect(page).toHaveURL(/\/entries/);
});
