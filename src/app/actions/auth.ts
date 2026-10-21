"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  confirmPasswordReset,
  logIn,
  logOut,
  parseConfirmPasswordReset,
  parseLogIn,
  parseSignUp,
  requestPasswordReset,
  signUp,
} from "@/lib/api/features/auth";
import {
  acceptAuthRedirect,
  acceptCodeFromNext,
  acceptInvitation,
  invitationAccount,
  inviteEmailMismatch,
  parseAcceptInvitation,
} from "@/lib/api/features/invitations";
import { run, safeNext, text } from "@/lib/server/action";
import { clearSessionCookies, currentRefreshToken, getAccess, setSessionCookies } from "@/lib/server/session";
import { defaultOrganizationId } from "@/lib/portal";
import { writeOrganization } from "@/lib/server/session-cookies";
import type { ActionResult } from "@/lib/types";

export async function logInAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await run(async () => {
    const session = await logIn(parseLogIn({ username: text(formData, "username"), password: text(formData, "password") }));
    await setSessionCookies(session);
    const portalOrg = defaultOrganizationId();
    if (portalOrg) {
      writeOrganization(await cookies(), portalOrg);
    }
    return { mustChangePassword: session.user.mustChangePassword };
  });
  if (!result.ok) return result;
  const next = safeNext(text(formData, "next"));
  redirect(result.data?.mustChangePassword ? `/change-password?next=${encodeURIComponent(next)}` : next);
}

export async function signUpAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const next = safeNext(text(formData, "next"));
  const code = acceptCodeFromNext(next);
  const invite = code ? await invitationAccount(code) : null;
  if (code && !invite) {
    return { ok: false, error: "The code is not valid." };
  }

  if (invite?.userExists) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const result = await run(async () => {
    const session = await signUp(
      parseSignUp({
        firstName: text(formData, "firstName"),
        lastName: text(formData, "lastName"),
        username: text(formData, "username"),
        email: text(formData, "email"),
        password: text(formData, "password"),
        timezone: text(formData, "timezone") || undefined,
      }),
      invite ? { invitationEmail: invite.email } : undefined,
    );
    await setSessionCookies(session);
  });
  if (!result.ok) return result;
  redirect(next);
}

async function endSession() {
  const [access, refreshToken] = await Promise.all([getAccess(), currentRefreshToken()]);
  if (access && refreshToken) {
    await logOut(access, { refreshToken }).catch(() => undefined);
  }

  await clearSessionCookies();
}

export async function logOutAction() {
  await endSession();
  redirect("/login");
}

export async function logOutStayOnAcceptAction(code: string) {
  await endSession();
  const trimmed = code.trim();
  redirect(trimmed ? `/accept?code=${encodeURIComponent(trimmed)}` : "/accept");
}

export async function requestResetAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(
    () => requestPasswordReset(text(formData, "email")),
    "If that email has an account, a code is on its way.",
  );
}

export async function confirmResetAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(
    () =>
      confirmPasswordReset(
        parseConfirmPasswordReset({
          email: text(formData, "email"),
          code: text(formData, "code"),
          password: text(formData, "password"),
        }),
      ),
    "Password updated. You can sign in now.",
  );
}

export async function acceptInviteAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const code = text(formData, "code").trim();
  const access = await getAccess();
  if (!access) {
    const invite = await invitationAccount(code);
    if (!invite) {
      return { ok: false, error: "The code is not valid." };
    }

    redirect(acceptAuthRedirect(code, invite.userExists));
  }

  const result = await run(async () => {
    const accepted = await acceptInvitation(access, parseAcceptInvitation({ code }));
    writeOrganization(await cookies(), accepted.invitation.organizationId);
  });
  if (!result.ok) {
    return result.error === inviteEmailMismatch ? { ok: false, error: result.error, reason: "email_mismatch" } : result;
  }

  redirect("/dashboard");
}
