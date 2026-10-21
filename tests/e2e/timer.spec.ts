/**
 * Volunteer starts and stops the timer. Local named seed only.
 */
import { expect, test } from "@playwright/test";
import { createOrgPerson, deleteE2eEntries, deleteMembershipByEmail, loginAs } from "./helpers";

const stamp = Date.now().toString(36);
const person = {
  firstName: "E2e",
  lastName: "Timer",
  email: `e2e.timer+${stamp}@example.com`,
  username: `e2etimer${stamp}`,
  password: "timer-pass-99",
};

test.afterEach(async ({ request }) => {
  await deleteE2eEntries(request);
});

test.afterAll(async ({ request }) => {
  await deleteMembershipByEmail(request, person.email);
});

test("volunteer starts and stops the timer", async ({ page, request }) => {
  await createOrgPerson(request, person);
  await loginAs(page, person.username, person.password);
  await page.goto("/log/own");
  await page.getByLabel("What are you working on?").fill(`e2e-timer ${stamp}`);
  await page.getByRole("button", { name: "Start timer" }).click();
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Start timer" })).toBeVisible();
  await expect(page.getByText(`e2e-timer ${stamp}`)).toBeVisible();
});
