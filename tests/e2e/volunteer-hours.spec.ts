/**
 * Volunteer own Duration + Total, and Reports show only their hours.
 * Local named seed only — skipped on staging/production.
 */
import { expect, test } from "@playwright/test";
import {
  createOrgPerson,
  deleteE2eEntries,
  deleteMembershipByEmail,
  getReport,
  loginAs,
  loginBearer,
} from "./helpers";

const stamp = Date.now().toString(36);
const person = {
  firstName: "E2e",
  lastName: "Volunteer",
  email: `e2e.volunteer+${stamp}@example.com`,
  username: `e2evol${stamp}`,
  password: "volunteer-pass-99",
};

test.afterEach(async ({ request }) => {
  await deleteE2eEntries(request);
});

test.afterAll(async ({ request }) => {
  await deleteMembershipByEmail(request, person.email);
});

test("volunteer logs Duration and Total and sees only their hours on Reports", async ({ page, request }) => {
  await createOrgPerson(request, person);
  const organization = await loginAs(page, person.username, person.password);
  await page.goto("/log/own");
  await expect(page.getByText("Add time manually")).toBeVisible();

  await page.getByRole("button", { name: "Start and end" }).click();
  await page.getByLabel("Hours").fill("1");
  await page.getByLabel("Notes").fill(`e2e-volunteer-duration ${stamp}`);
  await page.getByRole("button", { name: "Save time" }).click();
  await expect(page.getByText("Time saved.")).toBeVisible();

  await page.getByRole("button", { name: "Total hours" }).click();
  await page.getByLabel("Hours").fill("2");
  await page.getByLabel("Notes").fill(`e2e-volunteer-total ${stamp}`);
  await page.getByRole("button", { name: "Save time" }).click();
  await expect(page.getByText("Time saved.")).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText("Total volunteer hours")).toBeVisible();
  await expect(page.getByText("3")).toBeVisible();

  const session = await loginBearer(page.request);
  const volunteerSession = await page.request.post("/auth/login", {
    data: { username: person.username, password: person.password },
  });
  expect(volunteerSession.ok(), await volunteerSession.text()).toBeTruthy();
  const volunteer = (await volunteerSession.json()) as { accessToken: string };
  const mine = await getReport(page.request, organization.id, volunteer.accessToken);
  const all = await getReport(page.request, organization.id, session.accessToken);
  expect(mine.user.hours).toBe(3);
  expect(all.user.hours).toBeGreaterThan(mine.user.hours);
});
