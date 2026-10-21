import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { publicSignupEnabled } from "@/lib/portal";
import { AuthCard, AuthFormSkeleton } from "../auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  if (!publicSignupEnabled()) {
    redirect("/login");
  }
  return (
    <AuthCard
      title="Create your account"
      description="Start tracking hours for your organization in a minute."
      footer={
        <>
          Already have an account?
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={5} />}>
        <SignupForm />
      </Suspense>
    </AuthCard>
  );
}
