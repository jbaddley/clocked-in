"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signUpAction } from "@/app/actions/auth";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/types";

export function SignupForm() {
  const next = useSearchParams().get("next") ?? "/dashboard";
  const [result, action] = useActionState((previous: ActionResult | null, formData: FormData) => {
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    return signUpAction(previous, formData);
  }, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" autoComplete="given-name" required className="h-10" />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" autoComplete="family-name" required className="h-10" />
        </Field>
      </div>
      <Field label="Username" htmlFor="username">
        <Input id="username" name="username" autoComplete="username" required className="h-10" />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-10" />
      </Field>
      <FormMessage result={result} />
      <SubmitButton className="h-10 w-full">Create account</SubmitButton>
    </form>
  );
}
