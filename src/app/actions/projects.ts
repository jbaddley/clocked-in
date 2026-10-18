"use server";

import { createProject, parseCreateProject, parseUpdateProject, updateProject } from "@/lib/api/features/projects";
import { body, run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export type ProjectInput = {
  title: string;
  projectType: "Project" | "Event";
  departmentId: string | null;
  startDate: string | null;
  endDate: string | null;
};

function placement(departmentId: string | null) {
  return departmentId
    ? { accessType: "Department" as const, departmentId }
    : { accessType: "Public" as const, departmentId: null };
}

export async function createProjectAction(organizationId: string, input: ProjectInput) {
  return run(async () => {
    const access = await requireAccess();
    return createProject(
      access,
      organizationId,
      parseCreateProject(
        body({
          title: input.title,
          projectType: input.projectType,
          ...placement(input.departmentId),
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ),
    );
  }, "Added.");
}

export async function updateProjectAction(projectId: string, input: ProjectInput) {
  return run(async () => {
    const access = await requireAccess();
    return updateProject(
      access,
      projectId,
      parseUpdateProject(
        body({
          title: input.title,
          projectType: input.projectType,
          ...placement(input.departmentId),
          startDate: input.startDate,
          endDate: input.endDate,
        }),
      ),
    );
  }, "Saved.");
}
