/**
 * Dashboard cards navigate to filtered reports. Local named seed only.
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

test("your hours card opens reports for that person", async ({ page, request }) => {
  const created = await createOrgPerson(request, person);
  await loginAs(page, person.username, person.password);
  await page.goto("/dashboard");
  await page.getByText("Your hours").click();
  await expect(page).toHaveURL(new RegExp(`/reports\\?userId=${created.membership.userId}`));
});
