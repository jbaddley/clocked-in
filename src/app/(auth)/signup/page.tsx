import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { acceptCodeFromNext, invitationAccount } from "@/lib/api/features/invitations";
import { portalName, publicSignupEnabled } from "@/lib/portal";
import { safeNext } from "@/lib/server/action";
import { AuthCard, AuthFormSkeleton } from "../auth-card";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const search = await searchParams;
  const next = safeNext(typeof search.next === "string" ? search.next : "");
  const code = acceptCodeFromNext(next);
  const invite = code ? await invitationAccount(code) : null;
  if (invite?.userExists) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const invitedEmail = invite?.email;
  if (!publicSignupEnabled() && !invitedEmail) {
    redirect(next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  }

  const signInHref = next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <AuthCard
      title="Create your account"
      description={
        invitedEmail
          ? `Create a ${portalName()} account for the email this invitation was sent to.`
          : "Start tracking hours for your organization in a minute."
      }
      footer={
        <>
          Already have an account?
          <Link href={signInHref} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<AuthFormSkeleton fields={5} />}>
        <SignupForm email={invitedEmail} />
      </Suspense>
    </AuthCard>
  );
}
