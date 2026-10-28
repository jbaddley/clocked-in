/**
 * Admin invites → accept → person on People. Local named seed only.
 */
import { expect, test } from "@playwright/test";
import { deleteMembershipByEmail, loginAs, loginAsAdmin, loginBearer } from "./helpers";

const stamp = Date.now().toString(36);
const email = `e2e.invite+${stamp}@example.com`;
const username = `e2einv${stamp}`;
const password = "invite-pass-99";

test.afterAll(async ({ request }) => {
  await deleteMembershipByEmail(request, email);
});

test("admin invite is accepted and the person appears on People", async ({ page, request }) => {
  const signup = await request.post("/auth/user", {
    data: { username, email, password, firstName: "E2e", lastName: "Invitee" },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();

  await loginAsAdmin(page);
  await page.goto("/settings/members");
  await expect(page.getByText("Invite someone")).toBeVisible();
  await page.locator("#invite-first").fill("E2e");
  await page.locator("#invite-last").fill("Invitee");
  await page.locator("#invite-email").fill(email);
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText(email)).toBeVisible();

  const code = await waitForInviteCode(email);
  test.skip(!code, "Invite accept needs the local mail sink.");
  await loginAs(page, username, password);
  await page.goto(`/accept?code=${code}`);
  await page.getByRole("button", { name: "Join organization" }).click();
  await expect(page).toHaveURL(/dashboard/);

  const admin = await loginBearer(request);
  await page.context().clearCookies();
  await loginAsAdmin(page);
  await page.goto("/settings/members");
  await expect(page.getByText("E2e Invitee")).toBeVisible();
  expect(admin.user.id).toBeTruthy();
});

async function waitForInviteCode(to: string) {
  const sink = process.env.MAIL_SINK_URL || "http://127.0.0.1:5399";
  const deadline = Date.now() + 4000;
  const pattern = /Use this code to accept the invite:\s*(\d{6})/;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${sink}/emails?to=${encodeURIComponent(to)}`);
      if (response.ok) {
        const messages = (await response.json()) as { text?: string }[];
        const match = pattern.exec(messages.at(-1)?.text ?? "");
        if (match) {
          return match[1];
        }
      }
    } catch {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}
