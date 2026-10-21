"use client";

import { FolderKanbanIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { deleteLookupAction } from "@/app/actions/lookups";
import { ProjectDialog } from "@/components/entity-forms/project-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { formatDate } from "@/lib/format";
import { keys } from "@/lib/queries";
import type { Project } from "@/lib/types";

const projectTypeGroups = [
  { type: "Project", label: "Projects" },
  { type: "Event", label: "Events" },
] as const;

function dateRange(project: Project) {
  if (project.startDate && project.endDate) {
    return `${formatDate(project.startDate)} – ${formatDate(project.endDate)}`;
  }

  if (project.startDate) return `From ${formatDate(project.startDate)}`;
  if (project.endDate) return `Until ${formatDate(project.endDate)}`;
  return "No dates";
}

function groupProjects(projects: Project[]) {
  return projectTypeGroups
    .map((group) => ({
      ...group,
      items: projects.filter((project) => (project.projectType === "Event" ? "Event" : "Project") === group.type),
    }))
    .filter((group) => group.items.length > 0);
}

export function ProjectsCard() {
  const organization = useOrganization();
  const { isCoordinator, groupDepartments } = useWorkspace();
  const copy = useLabels();
  const { lookups, names } = useLookups();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const visible = isCoordinator
    ? lookups.projects.filter(
        (project) => project.accessType === "Department" && project.departmentId && groupDepartments.includes(project.departmentId),
      )
    : lookups.projects;
  const groups = groupProjects(visible);
  const remove = useActionMutation((id: string) => deleteLookupAction("projects", id), {
    invalidate: [keys.lookups(organization.id)],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.projects}</CardTitle>
        <CardDescription>
          Assign a {copy.project.toLowerCase()} to a {copy.department.toLowerCase()} and give it a start and end date. Leave the{" "}
          {copy.department.toLowerCase()} as the whole {copy.organization.toLowerCase()} when everyone should see it.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" className="h-8" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length ? (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <section key={group.type} aria-labelledby={`project-type-${group.type}`} className="flex flex-col gap-2">
                <h3 id={`project-type-${group.type}`} className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h3>
                <ul className="divide-y rounded-lg border">
                  {group.items.map((project) => (
                    <li key={project.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{project.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {project.departmentId ? (names.department.get(project.departmentId) ?? copy.department) : `Whole ${copy.organization.toLowerCase()}`}
                          {" · "}
                          {dateRange(project)}
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Edit ${project.title}`} onClick={() => setEditing(project)}>
                        <PencilIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${project.title}`}
                        onClick={() => setPendingDelete(project)}
                      >
                        <Trash2Icon />
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState icon={FolderKanbanIcon} title="No projects yet" className="py-8" />
        )}
      </CardContent>
      <ProjectDialog open={creating} onOpenChange={setCreating} />
      <ProjectDialog open={editing !== null} project={editing} onOpenChange={(open) => !open && setEditing(null)} />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.title ?? "this project"}?`}
        description="Time already logged against it stays, but you will not be able to pick it for new entries."
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </Card>
  );
}
