/**
 * Coordinator scoped report. Local named seed only.
 */
import { expect, test } from "@playwright/test";
import {
  createOrgPerson,
  deleteE2eEntries,
  deleteMembershipByEmail,
  loginAs,
  loginBearer,
  makeCoordinator,
} from "./helpers";

const stamp = Date.now().toString(36);
const coordinator = {
  firstName: "E2e",
  lastName: "Coordinator",
  email: `e2e.coord+${stamp}@example.com`,
  username: `e2ecoord${stamp}`,
  password: "coord-pass-99",
};
const member = {
  firstName: "E2e",
  lastName: "Grouped",
  email: `e2e.grouped+${stamp}@example.com`,
  username: `e2egrp${stamp}`,
  password: "grouped-pass-99",
};

test.afterEach(async ({ request }) => {
  await deleteE2eEntries(request);
});

test.afterAll(async ({ request }) => {
  await deleteMembershipByEmail(request, coordinator.email);
  await deleteMembershipByEmail(request, member.email);
});

test("coordinator logs for a group member and sees only that group on Reports", async ({ page, request }) => {
  const session = await loginBearer(request);
  const headers = { authorization: `Bearer ${session.accessToken}` };
  const created = await createOrgPerson(request, coordinator);
  const lookups = await request.get(`/organizations/${created.organization.id}/lookups`, { headers });
  expect(lookups.ok(), await lookups.text()).toBeTruthy();
  const catalog = (await lookups.json()) as { departments: { id: string; name: string }[] };
  const department = catalog.departments.find((item) => item.name === "Visual Arts Society") ?? catalog.departments[0];
  expect(department, "department").toBeTruthy();
  await makeCoordinator(request, created.membership.userId, department.id);
  await createOrgPerson(request, { ...member, departmentIds: [department.id] });

  await loginAs(page, coordinator.username, coordinator.password);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByText("Group manager")).toBeVisible();
  await page.goto("/log/member");
  await expect(page.getByText("Add time for a member")).toBeVisible();
  await page.getByRole("combobox", { name: /person/i }).click();
  await page.getByRole("option", { name: "E2e Grouped" }).click();
  await page.getByRole("button", { name: "Total hours" }).click();
  await page.getByLabel("Hours").fill("1:00");
  await page.getByLabel("Notes").fill(`e2e-coord ${stamp}`);
  await page.getByRole("button", { name: "Save time" }).click();
  await expect(page.getByText("Time saved.")).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText(department.name)).toBeVisible();
  const other = catalog.departments.find((item) => item.id !== department.id);
  if (other) {
    await expect(page.getByText(other.name, { exact: true })).toHaveCount(0);
  }
});
