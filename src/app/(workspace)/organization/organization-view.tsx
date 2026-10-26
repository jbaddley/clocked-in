"use client";

import { useActionState, useEffect, useState } from "react";
import { updateOrganizationDetailsAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownView } from "@/components/markdown-view";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/hooks/use-labels";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { websiteHref } from "@/lib/url";
import { EditorLayout } from "./editor-layout";

type SaveStatus = {
  result: { ok: boolean; error?: string; message?: string } | null;
  pending: boolean;
};

export function OrganizationView() {
  const organization = useOrganization();
  const { isAdmin } = useWorkspace();
  const copy = useLabels();
  const [status, setStatus] = useState<SaveStatus>({ result: null, pending: false });

  return (
    <EditorLayout
      footer={
        isAdmin ? (
          <div
            role="group"
            aria-label={`${copy.organization} actions`}
            className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-center"
          >
            <SaveBar result={status.result}>
              <SubmitButton form="organization-form" pending={status.pending} className="h-9 w-full sm:ml-auto sm:w-auto">
                Save {copy.organization.toLowerCase()}
              </SubmitButton>
            </SaveBar>
          </div>
        ) : null
      }
    >
      <OrganizationFields key={organization.id} editable={isAdmin} onStatus={setStatus} />
    </EditorLayout>
  );
}

function SaveBar({
  result,
  children,
}: {
  result: { ok: boolean; error?: string; message?: string } | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <FormMessage result={result} />
      </div>
      {children}
    </>
  );
}

function OrganizationFields({ editable, onStatus }: { editable: boolean; onStatus: (status: SaveStatus) => void }) {
  const organization = useOrganization();
  const copy = useLabels();
  const [result, action, pending] = useActionState(updateOrganizationDetailsAction.bind(null, organization.id), null);
  const website = organization.websiteUrl ? websiteHref(organization.websiteUrl) : null;

  useEffect(() => {
    onStatus({ result, pending });
  }, [onStatus, pending, result]);

  const fields = (
    <Card>
      <CardHeader>
        <CardTitle>{copy.organization}</CardTitle>
        <CardDescription>
          {editable
            ? "Name, website, and description shown on the home page."
            : "Name, website, and description shown on the home page. An organization admin can change these."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            name={editable ? "name" : undefined}
            required={editable}
            readOnly={!editable}
            maxLength={200}
            defaultValue={organization.name}
            className="h-9"
          />
        </Field>
        <Field label="Website" htmlFor="websiteUrl" hint={editable ? "Leave blank to remove the link." : undefined}>
          {editable ? (
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              inputMode="url"
              maxLength={2000}
              defaultValue={organization.websiteUrl ?? ""}
              placeholder="https://"
              className="h-9"
            />
          ) : website ? (
            <a
              id="websiteUrl"
              href={website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center text-sm text-primary underline-offset-2 hover:underline"
            >
              {organization.websiteUrl}
            </a>
          ) : (
            <p id="websiteUrl" className="flex h-9 items-center text-sm text-muted-foreground">
              No website
            </p>
          )}
        </Field>
        <Field label="Description" htmlFor="description" hint={editable ? "Shown on the home page." : undefined}>
          {editable ? (
            <MarkdownEditor
              id="description"
              name="description"
              label="Description"
              maxLength={8000}
              defaultValue={organization.description ?? ""}
            />
          ) : organization.description?.trim() ? (
            <MarkdownView source={organization.description} />
          ) : (
            <p id="description" className="text-sm text-muted-foreground">
              No description yet.
            </p>
          )}
        </Field>
      </CardContent>
    </Card>
  );

  if (!editable) return fields;

  return (
    <form id="organization-form" action={action}>
      {fields}
    </form>
  );
}
