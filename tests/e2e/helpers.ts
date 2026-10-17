import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { caswjSourceRefPrefix, orgName } from "../../scripts/caswj-workbook";

export const extraNotes = "e2e-extra";

export type ReportGroup = {
  id: string;
  label: string;
  hours: number;
  volunteers: number;
  entries: number;
  inKind: number;
};

export type ReportSide = {
  hours: number;
  volunteers?: number;
  entries: number;
  inKind: number;
  byDepartment: ReportGroup[];
  byCategory: ReportGroup[];
  byPerson?: ReportGroup[];
  byVolunteer?: ReportGroup[];
  byProject: ReportGroup[];
  byMonth?: ReportGroup[];
};

export type UserReportSide = ReportSide & {
  volunteers: number;
  byPerson: ReportGroup[];
  byVolunteer: ReportGroup[];
  byMonth: ReportGroup[];
};

export type ReportPayload = { user: UserReportSide; collective: ReportSide };

export type Organization = { id: string; name: string };

export function adminPassword() {
  const password = process.env.SEED_SUPERADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("SEED_SUPERADMIN_PASSWORD is required.");
  }

  return password;
}

export async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.locator("#username").fill("jbaddley");
  await page.locator("#password").fill(adminPassword());
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  const organization = await caswjOrganization(page.request);
  await page.context().addCookies([
    {
      name: "clocked-in-org",
      value: organization.id,
      url: page.url(),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return organization;
}

export async function caswjOrganization(request: APIRequestContext, token?: string) {
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  const response = await request.get("/organizations?limit=100", { headers });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { items: Organization[] };
  const organization = body.items.find((item) => item.name === orgName);
  if (!organization) {
    throw new Error("CASWJ organization was not found. Run npm run db:seed:caswj.");
  }

  return organization;
}

export async function getReport(request: APIRequestContext, organizationId: string, token?: string) {
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  const response = await request.get(`/organizations/${organizationId}/report?_=${Date.now()}`, { headers });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as ReportPayload;
}

export async function getCsv(request: APIRequestContext, organizationId: string, kind: "log" | "summary") {
  const path = kind === "log" ? "time-entries.csv" : "summary.csv";
  const response = await request.get(`/organizations/${organizationId}/${path}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.text();
}

export async function loginBearer(request: APIRequestContext) {
  const response = await request.post("/auth/login", {
    data: { username: "jbaddley", password: adminPassword() },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as { accessToken: string; user: { id: string } };
  return body;
}

export async function deleteE2eEntries(request: APIRequestContext) {
  const session = await loginBearer(request);
  const headers = { authorization: `Bearer ${session.accessToken}` };
  const organization = await caswjOrganization(request, session.accessToken);
  const listed = await request.get(`/users/${session.user.id}/time-entries?organizationId=${organization.id}&limit=100`, {
    headers,
  });
  expect(listed.ok(), await listed.text()).toBeTruthy();
  const body = (await listed.json()) as {
    items: { id: string; description: string | null; sourceRef: string | null }[];
  };
  for (const entry of body.items) {
    if (entry.sourceRef?.startsWith(caswjSourceRefPrefix)) {
      continue;
    }

    if (!(entry.description ?? "").startsWith("e2e-")) {
      continue;
    }

    const deleted = await request.delete(`/time-entries/${entry.id}`, { headers });
    expect(deleted.ok(), await deleted.text()).toBeTruthy();
  }
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

export function groupsByLabel(rows: ReportGroup[]) {
  return new Map(rows.map((row) => [row.label, row]));
}

export function expectGroups(
  actual: ReportGroup[],
  expected: ReportGroup[],
  options: { volunteers?: boolean; id?: "label" | "month" | "department" } = {},
) {
  expect(actual, "group count").toHaveLength(expected.length);
  const found = groupsByLabel(actual);
  for (const row of expected) {
    const match = found.get(row.label);
    expect(match, `missing group ${row.label}`).toBeTruthy();
    if (!match) {
      continue;
    }

    expect(match.hours, `${row.label} hours`).toBe(row.hours);
    expect(match.entries, `${row.label} entries`).toBe(row.entries);
    expect(match.inKind, `${row.label} in-kind`).toBeCloseTo(row.inKind, 2);
    if (options.volunteers) {
      expect(match.volunteers, `${row.label} volunteers`).toBe(row.volunteers);
    }

    if (options.id === "month") {
      expect(match.id, `${row.label} month id`).toBe(row.id);
    }

    if (options.id === "department" && row.id === "organization") {
      expect(match.id).toBe("organization");
    }
  }
}

export async function openReports(page: Page) {
  const organization = await loginAsAdmin(page);
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByText(/valued at \$35\.47\/h \(2025\)/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Summary" })).toBeVisible();
  await expect(page.getByText("Updating…")).toHaveCount(0);
  return organization;
}

export function cardNamed(page: Page, title: string) {
  return page.locator("[data-slot='card']").filter({ has: page.locator("[data-slot='card-title']", { hasText: title }) }).first();
}

export function cardTitle(page: Page, title: string) {
  return page.locator("[data-slot='card-title']", { hasText: title });
}

export async function selectReportsTab(page: Page, name: string) {
  const tab = page.getByRole("tablist").getByRole("tab", { name, exact: true });
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}
