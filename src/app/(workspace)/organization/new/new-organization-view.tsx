"use client";

import { useActionState, useEffect, useState } from "react";
import { createOrganizationAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { labels } from "@/lib/labels";
import { EditorLayout } from "../editor-layout";

type SaveStatus = {
  result: { ok: boolean; error?: string; message?: string } | null;
  pending: boolean;
};

export function NewOrganizationView() {
  const { organization } = useWorkspace();
  const copy = labels(organization?.preferences);
  const [status, setStatus] = useState<SaveStatus>({ result: null, pending: false });

  return (
    <EditorLayout
      footer={
        <div
          role="group"
          aria-label={`New ${copy.organization.toLowerCase()} actions`}
          className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <FormMessage result={status.result} />
          </div>
          <SubmitButton form="new-organization-form" pending={status.pending} className="h-9 w-full sm:ml-auto sm:w-auto">
            Create {copy.organization.toLowerCase()}
          </SubmitButton>
        </div>
      }
    >
      <NewOrganizationForm onStatus={setStatus} />
    </EditorLayout>
  );
}

function NewOrganizationForm({ onStatus }: { onStatus: (status: SaveStatus) => void }) {
  const { organization } = useWorkspace();
  const copy = labels(organization?.preferences);
  const [result, action, pending] = useActionState(createOrganizationAction, null);

  useEffect(() => {
    onStatus({ result, pending });
  }, [onStatus, pending, result]);

  return (
    <form id="new-organization-form" action={action}>
      <Card>
        <CardHeader>
          <CardTitle>New {copy.organization.toLowerCase()}</CardTitle>
          <CardDescription>You will be its first admin. Switch between organizations any time from the top bar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label={`${copy.organization} name`} htmlFor="name">
            <Input id="name" name="name" required maxLength={200} placeholder="Riverside Food Bank" className="h-9" autoFocus />
          </Field>
        </CardContent>
      </Card>
    </form>
  );
}
