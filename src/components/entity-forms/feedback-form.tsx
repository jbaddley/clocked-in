"use client";

import { useId, useState } from "react";
import { createFeedbackAction } from "@/app/actions/feedback";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { Field, FormMessage } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useWorkspace } from "@/hooks/use-workspace";
import { feedbackAreas, feedbackPriorities, feedbackTypes } from "@/lib/feedback";
import { keys } from "@/lib/queries";
import type { ActionResult } from "@/lib/types";

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const idPrefix = useId();
  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Send feedback"
      description="Tell us about a bug or a feature that would help you."
      className="sm:max-w-lg"
    >
      <FeedbackForm idPrefix={idPrefix} onCreated={() => onOpenChange(false)} onCancel={() => onOpenChange(false)} />
    </EntityFormDialog>
  );
}

function FeedbackForm({
  idPrefix,
  onCreated,
  onCancel,
}: {
  idPrefix: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { organization } = useWorkspace();
  const [type, setType] = useState("Bug");
  const [priority, setPriority] = useState("Medium");
  const [area, setArea] = useState("Other");
  const create = useActionMutation((formData: FormData) => createFeedbackAction(formData), {
    invalidate: [keys.feedback()],
    onSuccess: onCreated,
    errorToast: false,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        create.mutate(formData);
      }}
    >
      {organization ? <input type="hidden" name="organizationId" value={organization.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor={`${idPrefix}-type`}>
          <SelectField
            id={`${idPrefix}-type`}
            value={type}
            onValueChange={setType}
            options={feedbackTypes}
          />
        </Field>
        <input type="hidden" name="type" value={type} />
        <Field label="Priority" htmlFor={`${idPrefix}-priority`}>
          <SelectField
            id={`${idPrefix}-priority`}
            value={priority}
            onValueChange={setPriority}
            options={feedbackPriorities}
          />
        </Field>
        <input type="hidden" name="priority" value={priority} />
        <Field label="Area" htmlFor={`${idPrefix}-area`} className="sm:col-span-2">
          <SelectField id={`${idPrefix}-area`} value={area} onValueChange={setArea} options={feedbackAreas} />
        </Field>
        <input type="hidden" name="area" value={area} />
      </div>
      <Field label="Title" htmlFor={`${idPrefix}-title`}>
        <Input id={`${idPrefix}-title`} name="title" required maxLength={120} autoFocus className="h-9" />
      </Field>
      <Field label="Description" htmlFor={`${idPrefix}-description`}>
        <Textarea id={`${idPrefix}-description`} name="description" required maxLength={4000} rows={5} />
      </Field>
      <Field label="Screenshots" htmlFor={`${idPrefix}-screenshots`} hint="Optional. Up to 5 images, 4 MB each.">
        <Input id={`${idPrefix}-screenshots`} name="screenshots" type="file" accept="image/*" multiple className="h-9" />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <FormMessage result={create.error ? ({ ok: false, error: create.error.message } satisfies ActionResult) : create.isSuccess ? { ok: true } : null} />
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pending={create.isPending}>Send feedback</SubmitButton>
      </div>
    </form>
  );
}
