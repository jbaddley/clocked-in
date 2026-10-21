"use server";

import { importDepartments, importPeople, importProjects } from "@/lib/api/features/imports";
import { run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export async function importPeopleAction(organizationId: string, rows: Record<string, string>[]) {
  return run(async () => {
    const access = await requireAccess();
    return importPeople(access, organizationId, rows);
  });
}

export async function importDepartmentsAction(organizationId: string, rows: Record<string, string>[]) {
  return run(async () => {
    const access = await requireAccess();
    return importDepartments(access, organizationId, rows);
  });
}

export async function importProjectsAction(organizationId: string, rows: Record<string, string>[]) {
  return run(async () => {
    const access = await requireAccess();
    return importProjects(access, organizationId, rows);
  });
}
