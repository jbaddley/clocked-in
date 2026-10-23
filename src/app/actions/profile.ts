"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { logIn, parseLogIn } from "@/lib/api/features/auth";
import { parseUpdateUser, updateUser } from "@/lib/api/features/users";
import { body, run, safeNext, text } from "@/lib/server/action";
import { requireAccess, setSessionCookies } from "@/lib/server/session";
import type { ActionResult } from "@/lib/types";

export async function updateProfileAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    await updateUser(
      access,
      access.caller.id,
      parseUpdateUser(
        body({
          username: text(formData, "username"),
          email: text(formData, "email"),
          firstName: text(formData, "firstName"),
          lastName: text(formData, "lastName"),
          displayName: text(formData, "displayName"),
          timezone: text(formData, "timezone"),
          phone: text(formData, "phone"),
          zipCode: text(formData, "zipCode"),
          notes: text(formData, "notes"),
          avatarUrl: text(formData, "avatarUrl"),
          description: text(formData, "description"),
        }),
      ),
      true,
    );
    refresh();
  }, "Profile saved.");
}

export async function changePasswordAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirmPassword");
  if (!password) {
    return { ok: false, error: "Enter a new password." };
  }

  if (password !== confirmPassword) {
    return { ok: false, error: "The new passwords do not match." };
  }

  const result = await run(async () => {
    const access = await requireAccess({ allowPasswordChange: true });
    const updated = await updateUser(
      access,
      access.caller.id,
      parseUpdateUser(body({ password, currentPassword: text(formData, "currentPassword") })),
      true,
    );
    await setSessionCookies(await logIn(parseLogIn({ username: updated.username, password })));
    return updated;
  }, "Password updated. Other sessions were signed out.");
  if (!result.ok) return result;
  const next = text(formData, "next");
  if (next) {
    redirect(safeNext(next));
  }

  refresh();
  return result;
}
