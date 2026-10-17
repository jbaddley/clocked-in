"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { logInAction } from "@/app/actions/auth";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [result, action] = useActionState(logInAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Username" htmlFor="username">
        <Input id="username" name="username" autoComplete="username" required className="h-10" />
      </Field>
      <Field
        label={
          <span className="flex w-full items-center justify-between">
            Password
            <Link href="/forgot-password" className="text-xs font-normal tracking-normal text-primary normal-case hover:underline">
              Forgot password?
            </Link>
          </span>
        }
        htmlFor="password"
      >
        <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" />
      </Field>
      <FormMessage result={result} />
      <SubmitButton className="h-10 w-full">Sign in</SubmitButton>
    </form>
  );
}
