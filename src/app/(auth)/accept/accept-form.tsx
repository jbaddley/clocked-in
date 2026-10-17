"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { acceptInviteAction } from "@/app/actions/auth";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";

export function AcceptForm() {
  const code = useSearchParams().get("code") ?? "";
  const [result, action] = useActionState(acceptInviteAction, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Invite code" htmlFor="code">
        <Input id="code" name="code" defaultValue={code} required className="h-10 font-mono" />
      </Field>
      <FormMessage result={result} />
      <SubmitButton className="h-10 w-full">Join organization</SubmitButton>
    </form>
  );
}
