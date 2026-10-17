"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { createLookupAction, updateLookupAction, type NamedLookupKind } from "@/app/actions/lookups";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { namedEntity, rememberLookup, upsertNamed, type NamedEntity } from "@/components/entity-forms/lookup-cache";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useLabels } from "@/hooks/use-labels";
import { useOrganization } from "@/hooks/use-workspace";
import { keys } from "@/lib/queries";

type NameKind = NamedLookupKind;

function kindCopy(kind: NameKind, copy: ReturnType<typeof useLabels>) {
  if (kind === "departments") {
    return {
      noun: copy.department.toLowerCase(),
      description: `Teams or sites inside this ${copy.organization.toLowerCase()}. Hours can be logged against a ${copy.department.toLowerCase()}, and reports break down by it.`,
    };
  }

  if (kind === "categories") {
    return {
      noun: copy.taskCategory.toLowerCase(),
      description: "What kind of work was this? Used in reports.",
    };
  }

  return {
    noun: "tag",
    description: "Free-form labels volunteers can attach to an entry.",
  };
}

type FormProps = {
  entity?: NamedEntity;
  idPrefix?: string;
  label?: string;
  submitLabel?: string;
  layout?: "inline" | "stack";
  autoFocus?: boolean;
  onCreated?: (entity: NamedEntity) => void;
  onSaved?: (entity: NamedEntity) => void;
  onCancel?: () => void;
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity?: NamedEntity | null;
  onCreated?: (entity: NamedEntity) => void;
  onSaved?: (entity: NamedEntity) => void;
};

export function DepartmentForm(props: FormProps) {
  return <NameEntityForm kind="departments" {...props} />;
}

export function TaskCategoryForm(props: FormProps) {
  return <NameEntityForm kind="categories" {...props} />;
}

export function TagForm(props: FormProps) {
  return <NameEntityForm kind="tags" {...props} />;
}

export function NamedEntityDialog({ kind, open, onOpenChange, entity, onCreated, onSaved }: DialogProps & { kind: NameKind }) {
  const idPrefix = useId();
  const editing = Boolean(entity);
  const { noun, description } = kindCopy(kind, useLabels());
  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${noun}` : `Add a ${noun}`}
      description={description}
    >
      <NameEntityForm
        kind={kind}
        entity={entity ?? undefined}
        idPrefix={idPrefix}
        label="Name"
        submitLabel={editing ? "Save" : `Add ${noun}`}
        layout="stack"
        autoFocus
        onCancel={() => onOpenChange(false)}
        onCreated={(saved) => {
          onCreated?.(saved);
          onOpenChange(false);
        }}
        onSaved={(saved) => {
          onSaved?.(saved);
          onOpenChange(false);
        }}
      />
    </EntityFormDialog>
  );
}

export function CreateDepartmentDialog(props: DialogProps) {
  return <NamedEntityDialog kind="departments" {...props} />;
}

export function CreateTaskCategoryDialog(props: DialogProps) {
  return <NamedEntityDialog kind="categories" {...props} />;
}

export function CreateTagDialog(props: DialogProps) {
  return <NamedEntityDialog kind="tags" {...props} />;
}

function NameEntityForm({
  kind,
  entity,
  idPrefix = kind,
  label = "Name",
  submitLabel,
  layout = "inline",
  autoFocus = false,
  onCreated,
  onSaved,
  onCancel,
}: FormProps & { kind: NameKind }) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [name, setName] = useState(entity?.name ?? "");
  const invalidate = [keys.lookups(organization.id)];

  function remember(saved: NamedEntity) {
    rememberLookup(queryClient, organization.id, (current) => ({
      ...current,
      [kind]: upsertNamed(current[kind], { id: saved.id, organizationId: organization.id, name: saved.name }),
    }));
  }

  const create = useActionMutation((value: string) => createLookupAction(kind, organization.id, value), {
    invalidate,
    onSuccess: (data) => {
      if (namedEntity(data)) {
        remember(data);
        onCreated?.(data);
      }
      setName("");
    },
  });
  const update = useActionMutation((value: string) => updateLookupAction(kind, entity?.id ?? "", value), {
    invalidate,
    onSuccess: (data) => {
      if (namedEntity(data)) {
        remember(data);
        onSaved?.(data);
      }
    },
  });
  const inputId = `${idPrefix}-name`;
  const pending = entity ? update.isPending : create.isPending;

  return (
    <form
      className={cn("flex gap-2", layout === "stack" ? "flex-col gap-4" : "flex-col sm:flex-row")}
      onSubmit={(event) => {
        event.preventDefault();
        const value = name.trim();
        if (!value) return;
        if (entity) update.mutate(value);
        else create.mutate(value);
      }}
    >
      <Field label={label} htmlFor={inputId} className="flex-1">
        <Input
          id={inputId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus={autoFocus}
          className="h-9"
        />
      </Field>
      <div className={cn("flex gap-2", layout === "stack" ? "justify-end" : "sm:mt-6")}>
        {onCancel ? (
          <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <SubmitButton pending={pending} className="h-9 w-auto">
          {submitLabel ?? (entity ? "Save" : "Add")}
        </SubmitButton>
      </div>
    </form>
  );
}
