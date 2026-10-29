import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePinnedOrganizationOrApex } from "@/lib/server/tenant";
import { AuthCard, AuthFormSkeleton } from "../auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to log and review volunteer hours."
      footer={
        <Suspense fallback={null}>
          <LoginFooter />
        </Suspense>
      }
    >
      <Suspense fallback={<AuthFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFooter() {
  const pinned = await requirePinnedOrganizationOrApex();
  if (pinned.pinned) {
    return null;
  }

  return (
    <>
      New here?
      <Link href="/signup" className="font-medium text-primary hover:underline">
        Create an account
      </Link>
    </>
  );
}
