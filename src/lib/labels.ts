import type { OrganizationPreferences } from "@/lib/api/features/organizations";

export type EntityLabels = {
  organization: string;
  project: string;
  department: string;
  taskCategory: string;
};

export const defaultEntityLabels: EntityLabels = {
  organization: "Organization",
  project: "Project",
  department: "Department",
  taskCategory: "Task category",
};

export function readEntityLabels(preferences?: Pick<OrganizationPreferences, "entityLabels"> | null): EntityLabels {
  return { ...defaultEntityLabels, ...preferences?.entityLabels };
}

function pluralize(label: string) {
  if (label.endsWith("s") || label.endsWith("S")) {
    return label;
  }

  if (/[yY]$/.test(label) && !/[aeiouAEIOU][yY]$/.test(label)) {
    return `${label.slice(0, -1)}ies`;
  }

  return `${label}s`;
}

export function labels(preferences?: Pick<OrganizationPreferences, "entityLabels"> | null) {
  const entity = readEntityLabels(preferences);
  return {
    ...entity,
    organizations: pluralize(entity.organization),
    projects: pluralize(entity.project),
    departments: pluralize(entity.department),
    taskCategories: pluralize(entity.taskCategory),
  };
}
