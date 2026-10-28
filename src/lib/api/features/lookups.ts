import type { Access } from "@/lib/api/access";
import { listDepartments } from "@/lib/api/features/departments";
import { listHourlyRates } from "@/lib/api/features/hourly-rates";
import { listProjects } from "@/lib/api/features/projects";
import { listTags } from "@/lib/api/features/tags";
import { listTaskCategories } from "@/lib/api/features/task-categories";
import type { Lookups } from "@/lib/types";

function limit(extra?: Record<string, string>) {
  return new URLSearchParams({ limit: "100", ...extra });
}

export async function loadLookups(access: Access, organizationId: string): Promise<Lookups> {
  const [departments, projects, categories, tags, hourlyRates] = await Promise.all([
    listDepartments(access, organizationId, limit()),
    listProjects(access, organizationId, limit({ includeInactive: "true" })),
    listTaskCategories(access, organizationId, limit()),
    listTags(access, organizationId, limit({ includeArchived: "true" })),
    listHourlyRates(access, organizationId, limit()),
  ]);
  return {
    departments: departments.items,
    projects: projects.items,
    categories: categories.items,
    tags: tags.items.filter((tag) => !("isArchived" in tag) || tag.isArchived !== true),
    hourlyRates: hourlyRates.items,
  };
}
