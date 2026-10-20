"use client";

import { useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "cn";
import { createLookupAction } from "@/app/actions/lookups";
import { EntitySelect } from "@/components/entity-forms/entity-select";
import { CreateDepartmentDialog, CreateTaskCategoryDialog } from "@/components/entity-forms/name-entity-form";
import { namedEntity, rememberLookup, upsertNamed } from "@/components/entity-forms/lookup-cache";
import { CreateProjectDialog } from "@/components/entity-forms/project-form";
import { Field } from "@/components/field";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { organizationWide, type PlacementState } from "@/hooks/use-placement";
import { useLabels } from "@/hooks/use-labels";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { keys } from "@/lib/queries";

type Creating = "project" | "category" | "department" | null;
type TagOption = { id: string; name: string };

export function PlacementFields({
  state,
  compact = false,
  departmentIds,
}: {
  state: PlacementState;
  compact?: boolean;
  departmentIds?: string[];
}) {
  const { lookups, value, set } = state;
  const departments = departmentIds
    ? lookups.departments.filter((item) => departmentIds.includes(item.id))
    : lookups.departments;
  const { isAdmin } = useWorkspace();
  const copy = useLabels();
  const [creating, setCreating] = useState<Creating>(null);
  const span = compact ? "sm:col-span-4" : "md:col-span-4";
  const projectSpan = compact ? "sm:col-span-2" : "md:col-span-2";

  return (
    <>
      <div className={cn("grid gap-4", compact ? "sm:grid-cols-4" : "md:grid-cols-4")}>
        <EntitySelect
          label={copy.project}
          value={value.projectId}
          onValueChange={(projectId) => set({ projectId })}
          options={lookups.projects.map((item) => ({ value: item.id, label: item.title }))}
          createLabel={`Add a ${copy.project.toLowerCase()}`}
          onCreate={() => setCreating("project")}
          className={projectSpan}
        />
        <EntitySelect
          label={copy.taskCategory}
          value={value.taskCategoryId}
          onValueChange={(taskCategoryId) => set({ taskCategoryId })}
          options={lookups.categories.map((item) => ({ value: item.id, label: item.name }))}
          createLabel={`Add a ${copy.taskCategory.toLowerCase()}`}
          onCreate={() => setCreating("category")}
        />
        <EntitySelect
          label={copy.department}
          value={value.departmentId}
          onValueChange={(departmentId) => set({ departmentId })}
          options={
            departmentIds
              ? departments.map((item) => ({ value: item.id, label: item.name }))
              : [
                  { value: organizationWide, label: `Whole ${copy.organization.toLowerCase()}` },
                  ...departments.map((item) => ({ value: item.id, label: item.name })),
                ]
          }
          createLabel={`Add a ${copy.department.toLowerCase()}`}
          onCreate={departmentIds ? undefined : () => setCreating("department")}
        />
        {lookups.tags.length || isAdmin ? (
          <Field label="Tags" className={span}>
            <TagInput tags={lookups.tags} selected={value.tagIds} onChange={(tagIds) => set({ tagIds })} canCreate={isAdmin} />
          </Field>
        ) : null}
      </div>
      <CreateProjectDialog
        open={creating === "project"}
        onOpenChange={(open) => !open && setCreating(null)}
        onCreated={(project) => set({ projectId: project.id })}
      />
      <CreateTaskCategoryDialog
        open={creating === "category"}
        onOpenChange={(open) => !open && setCreating(null)}
        onCreated={(category) => set({ taskCategoryId: category.id })}
      />
      <CreateDepartmentDialog
        open={creating === "department"}
        onOpenChange={(open) => !open && setCreating(null)}
        onCreated={(department) => set({ departmentId: department.id })}
      />
    </>
  );
}

function TagInput({
  tags,
  selected,
  onChange,
  canCreate,
}: {
  tags: TagOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  canCreate: boolean;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selected);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  selectedRef.current = selected;

  const create = useActionMutation((name: string) => createLookupAction("tags", organization.id, name), {
    invalidate: [keys.lookups(organization.id)],
    silent: true,
    onSuccess: (data) => {
      if (!namedEntity(data)) return;
      rememberLookup(queryClient, organization.id, (current) => ({
        ...current,
        tags: upsertNamed(current.tags, { id: data.id, organizationId: organization.id, name: data.name }),
      }));
      if (!selectedRef.current.includes(data.id)) {
        onChange([...selectedRef.current, data.id]);
      }
      setDraft("");
    },
  });

  const trimmed = draft.trim();
  const query = trimmed.toLowerCase();
  const exact = tags.find((tag) => tag.name.toLowerCase() === query);
  const suggestions = tags
    .filter((tag) => !selected.includes(tag.id) && (!query || tag.name.toLowerCase().includes(query)))
    .slice(0, 8);
  const showCreate = canCreate && trimmed.length > 0 && !exact && !create.isPending;
  const chosen = selected
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is TagOption => Boolean(tag));

  function select(id: string) {
    if (!selectedRef.current.includes(id)) {
      onChange([...selectedRef.current, id]);
    }
    setDraft("");
    inputRef.current?.focus();
  }

  function remove(id: string) {
    onChange(selectedRef.current.filter((current) => current !== id));
    inputRef.current?.focus();
  }

  function commit() {
    if (!trimmed || create.isPending) return;
    if (exact) {
      select(exact.id);
      return;
    }
    if (canCreate) create.mutate(trimmed);
  }

  return (
    <div>
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {chosen.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex h-6 max-w-full items-center gap-0.5 rounded-full bg-secondary pr-0.5 pl-2 text-xs text-secondary-foreground"
          >
            <span className="truncate">{tag.name}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              aria-label={`Remove ${tag.name}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => remove(tag.id)}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          aria-label="Add a tag"
          aria-expanded={open}
          placeholder={chosen.length ? "" : "Add a tag"}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commit();
            } else if (event.key === "Backspace" && !draft && selected.length > 0) {
              event.preventDefault();
              remove(selected[selected.length - 1]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && (suggestions.length > 0 || showCreate) ? (
        <ul className="mt-1 max-h-44 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md" role="listbox">
          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                role="option"
                className="flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(tag.id)}
              >
                {tag.name}
              </button>
            </li>
          ))}
          {showCreate ? (
            <li>
              <button
                type="button"
                role="option"
                className="flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={commit}
              >
                Add “{trimmed}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
