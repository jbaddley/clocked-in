"use server";

import { createDepartment, deleteDepartment, updateDepartment } from "@/lib/api/features/departments";
import { parseName } from "@/lib/api/features/organizations";
import { createProject, deleteProject, parseCreateProject } from "@/lib/api/features/projects";
import { createTag, deleteTag, updateTag } from "@/lib/api/features/tags";
import { createTaskCategory, deleteTaskCategory, updateTaskCategory } from "@/lib/api/features/task-categories";
import { run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export type LookupKind = "departments" | "projects" | "categories" | "tags";
export type NamedLookupKind = Exclude<LookupKind, "projects">;

export async function createLookupAction(kind: LookupKind, organizationId: string, name: string) {
  return run(async () => {
    const access = await requireAccess();
    switch (kind) {
      case "departments":
        return createDepartment(access, organizationId, parseName({ name }));
      case "categories":
        return createTaskCategory(access, organizationId, parseName({ name }));
      case "tags":
        return createTag(access, organizationId, parseName({ name }));
      case "projects":
        return createProject(access, organizationId, parseCreateProject({ title: name, accessType: "Public" }));
    }
  }, "Added.");
}

export async function updateLookupAction(kind: NamedLookupKind, id: string, name: string) {
  return run(async () => {
    const access = await requireAccess();
    const request = parseName({ name });
    switch (kind) {
      case "departments":
        return updateDepartment(access, id, request);
      case "categories":
        return updateTaskCategory(access, id, request);
      case "tags":
        return updateTag(access, id, request);
    }
  }, "Saved.");
}

export async function deleteLookupAction(kind: LookupKind, id: string) {
  return run(async () => {
    const access = await requireAccess();
    switch (kind) {
      case "departments":
        return deleteDepartment(access, id);
      case "categories":
        return deleteTaskCategory(access, id);
      case "tags":
        return deleteTag(access, id);
      case "projects":
        return deleteProject(access, id);
    }
  }, "Deleted.");
}
