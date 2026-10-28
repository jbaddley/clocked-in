"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { createProjectAction, updateProjectAction, type ProjectInput } from "@/app/actions/projects";
import { DialogActions } from "@/components/dialog-actions";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { EntitySelect } from "@/components/entity-forms/entity-select";
import { rememberLookup, savedProject, upsertProject } from "@/components/entity-forms/lookup-cache";
import { CreateDepartmentDialog } from "@/components/entity-forms/name-entity-form";
import { Field } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { organizationWide } from "@/hooks/use-placement";
import { useOrganization } from "@/hooks/use-workspace";
import { keys } from "@/lib/queries";
import type { Project } from "@/lib/types";

const projectTypes = [
  { value: "Project", label: "Project" },
  { value: "Event", label: "Event" },
] as const;

type Draft = {
  title: string;
  projectType: "Project" | "Event";
  departmentId: string;
  startDate: string;
  endDate: string;
};

const blank: Draft = {
  title: "",
  projectType: "Project",
  departmentId: organizationWide,
  startDate: "",
  endDate: "",
};

function dateError(draft: Draft) {
  if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
    return "End date must be on or after the start date.";
  }

  return null;
}

function toInput(draft: Draft): ProjectInput {
  return {
    title: draft.title.trim(),
    projectType: draft.projectType,
    departmentId: draft.departmentId === organizationWide ? null : draft.departmentId,
    startDate: draft.startDate || null,
    endDate: draft.endDate || null,
  };
}

function fromProject(project: Project): Draft {
  return {
    title: project.title,
    projectType: project.projectType === "Event" ? "Event" : "Project",
    departmentId: project.departmentId ?? organizationWide,
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
  };
}

export function ProjectForm({
  project,
  idPrefix = "project",
  submitLabel,
  layout = "stack",
  autoFocus = false,
  onCreated,
  onSaved,
  onCancel,
}: {
  project?: Project;
  idPrefix?: string;
  submitLabel?: string;
  layout?: "grid" | "stack";
  autoFocus?: boolean;
  onCreated?: (project: Project) => void;
  onSaved?: (project: Project) => void;
  onCancel?: () => void;
}) {
  const organization = useOrganization();
  const copy = useLabels();
  const queryClient = useQueryClient();
  const { lookups } = useLookups();
  const [draft, setDraft] = useState<Draft>(() => (project ? fromProject(project) : blank));
  const [error, setError] = useState<string | null>(null);
  const [addingDepartment, setAddingDepartment] = useState(false);
  const invalidate = [keys.lookups(organization.id)];
  const departments = [
    { value: organizationWide, label: `Whole ${copy.organization.toLowerCase()}` },
    ...lookups.departments.map((item) => ({ value: item.id, label: item.name })),
  ];

  function remember(saved: Project) {
    rememberLookup(queryClient, organization.id, (current) => ({
      ...current,
      projects: upsertProject(current.projects, saved),
    }));
  }

  const create = useActionMutation((input: ProjectInput) => createProjectAction(organization.id, input), {
    invalidate,
    onSuccess: (data) => {
      if (savedProject(data)) {
        remember(data);
        onCreated?.(data);
      }
      setDraft((current) => ({ ...blank, projectType: current.projectType, departmentId: current.departmentId }));
      setError(null);
    },
  });
  const update = useActionMutation((input: ProjectInput) => updateProjectAction(project?.id ?? "", input), {
    invalidate,
    onSuccess: (data) => {
      if (savedProject(data)) {
        remember(data);
        onSaved?.(data);
      } else {
        onSaved?.(project as Project);
      }
      setError(null);
    },
  });

  function submit() {
    const nextError = dateError(draft);
    setError(nextError);
    if (nextError || !draft.title.trim()) return;
    const input = toInput(draft);
    if (project) update.mutate(input);
    else create.mutate(input);
  }

  return (
    <>
      <form
        id={`${idPrefix}-form`}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className={cn("grid gap-3", layout === "grid" ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2")}>
          <Field label={copy.project} htmlFor={`${idPrefix}-title`} className="sm:col-span-2">
            <Input
              id={`${idPrefix}-title`}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              required
              autoFocus={autoFocus}
              className="h-9"
            />
          </Field>
          <EntitySelect
            id={`${idPrefix}-type`}
            label="Type"
            value={draft.projectType}
            onValueChange={(projectType) =>
              setDraft({ ...draft, projectType: projectType === "Event" ? "Event" : "Project" })
            }
            options={[...projectTypes]}
            className="sm:col-span-2"
          />
          <EntitySelect
            id={`${idPrefix}-department`}
            label={copy.department}
            value={draft.departmentId}
            onValueChange={(departmentId) => setDraft({ ...draft, departmentId })}
            options={departments}
            createLabel={`Add a ${copy.department.toLowerCase()}`}
            onCreate={() => setAddingDepartment(true)}
            className="sm:col-span-2"
          />
          <Field label="Start date" htmlFor={`${idPrefix}-start`}>
            <Input
              id={`${idPrefix}-start`}
              type="date"
              value={draft.startDate}
              max={draft.endDate || undefined}
              onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="End date" htmlFor={`${idPrefix}-end`}>
            <Input
              id={`${idPrefix}-end`}
              type="date"
              value={draft.endDate}
              min={draft.startDate || undefined}
              onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
              className="h-9"
            />
          </Field>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogActions form={`${idPrefix}-form`}>
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <SubmitButton pending={project ? update.isPending : create.isPending}>
            {submitLabel ?? (project ? "Save" : "Add")}
          </SubmitButton>
        </DialogActions>
      </form>
      <CreateDepartmentDialog
        open={addingDepartment}
        onOpenChange={setAddingDepartment}
        onCreated={(department) => setDraft((current) => ({ ...current, departmentId: department.id }))}
      />
    </>
  );
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onCreated,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  onCreated?: (project: Project) => void;
  onSaved?: (project: Project) => void;
}) {
  const idPrefix = useId();
  const editing = Boolean(project);
  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit project" : "Add a project"}
      description="Assign a project to a department and give it a start and end date. Leave the department as the whole organization when everyone should see it."
      className="sm:max-w-lg"
    >
      <ProjectForm
        project={project ?? undefined}
        idPrefix={idPrefix}
        submitLabel={editing ? "Save" : "Add project"}
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

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: Project) => void;
}) {
  return <ProjectDialog open={open} onOpenChange={onOpenChange} onCreated={onCreated} />;
}
