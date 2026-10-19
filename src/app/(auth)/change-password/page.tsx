import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "../auth-card";
import { safeNext } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

function destination(next: string | string[] | undefined) {
  const value = safeNext(typeof next === "string" ? next : "");
  return value.startsWith("/change-password") ? "/dashboard" : value;
}

export default async function ChangePasswordPage({ searchParams }: PageProps<"/change-password">) {
  const [access, search] = await Promise.all([requireAccess({ allowPasswordChange: true }), searchParams]);
  const next = destination(search.next);
  if (!access.caller.mustChangePassword) {
    redirect(next);
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Your administrator set a temporary password. Pick a new one to continue."
    >
      <ChangePasswordForm next={next} />
    </AuthCard>
  );
}
