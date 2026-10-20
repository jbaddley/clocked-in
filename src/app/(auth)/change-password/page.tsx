import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard, AuthFormSkeleton } from "../auth-card";
import { safeNext } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change password" };

type Search = { next?: string | string[] };

function destination(next: string | string[] | undefined) {
  const value = safeNext(typeof next === "string" ? next : "");
  return value.startsWith("/change-password") ? "/dashboard" : value;
}

export default function ChangePasswordPage({ searchParams }: PageProps<"/change-password">) {
  return (
    <AuthCard
      title="Choose a new password"
      description="Your administrator set a temporary password. Pick a new one to continue."
    >
      <Suspense fallback={<AuthFormSkeleton fields={3} />}>
        <ChangePassword searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </AuthCard>
  );
}

async function ChangePassword({ searchParams }: { searchParams: Promise<Search> }) {
  const [access, search] = await Promise.all([requireAccess({ allowPasswordChange: true }), searchParams]);
  const next = destination(search.next);
  if (!access.caller.mustChangePassword) {
    redirect(next);
  }

  return <ChangePasswordForm next={next} />;
}
