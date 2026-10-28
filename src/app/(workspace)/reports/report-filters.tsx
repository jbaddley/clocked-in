"use client";

import { DateRangeFilter, useUrlParams } from "@/components/date-range-filter";
import { SelectField } from "@/components/select-field";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useMembers } from "@/hooks/use-members";
import { useWorkspace } from "@/hooks/use-workspace";
import { filtersFromSearch, type ReportFilters } from "@/lib/report-layout";

function personName(member: {
  user: { displayName: string | null; firstName: string | null; lastName: string | null; username: string };
}) {
  const display = member.user.displayName?.trim();
  if (display) return display;
  const full = [member.user.firstName, member.user.lastName].filter(Boolean).join(" ").trim();
  return full || member.user.username;
}

export function reportFiltersFromSearch(search: { get: (key: string) => string | null }): ReportFilters {
  return filtersFromSearch(search);
}

export function ReportFilters({ filters }: { filters: ReportFilters }) {
  const copy = useLabels();
  const { lookups } = useLookups();
  const { members } = useMembers();
  const { viewer, isCoordinator, groupDepartments } = useWorkspace();
  const params = {
    from: filters.from,
    to: filters.to,
    departmentId: filters.departmentId,
    taskCategoryId: filters.taskCategoryId,
    projectId: filters.projectId,
    userId: filters.userId,
  };
  const { update } = useUrlParams(params);
  const scoped = isCoordinator
    ? members.filter((member) => (member.departmentIds ?? []).some((id) => groupDepartments.includes(id)))
    : members;
  const people = scoped.map((member) => ({
    value: member.userId,
    label: member.userId === viewer.id ? `${personName(member)} (you)` : personName(member),
  }));

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <DateRangeFilter range={{ from: filters.from, to: filters.to }} params={params} />
      <SelectField
        aria-label={copy.department}
        className="sm:w-40"
        value={filters.departmentId ?? "any"}
        onValueChange={(value) => update({ departmentId: value === "any" ? undefined : value })}
        options={[
          { value: "any", label: `Any ${copy.department.toLowerCase()}` },
          ...lookups.departments.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
      <SelectField
        aria-label={copy.taskCategory}
        className="sm:w-44"
        value={filters.taskCategoryId ?? "any"}
        onValueChange={(value) => update({ taskCategoryId: value === "any" ? undefined : value })}
        options={[
          { value: "any", label: `Any ${copy.taskCategory.toLowerCase()}` },
          ...lookups.categories.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
      <SelectField
        aria-label={copy.project}
        className="sm:w-44"
        value={filters.projectId ?? "any"}
        onValueChange={(value) => update({ projectId: value === "any" ? undefined : value })}
        options={[
          { value: "any", label: `Any ${copy.project.toLowerCase()}` },
          ...lookups.projects.map((item) => ({ value: item.id, label: item.title })),
        ]}
      />
      <SelectField
        aria-label="Person"
        className="sm:w-44"
        value={filters.userId ?? "any"}
        onValueChange={(value) => update({ userId: value === "any" ? undefined : value })}
        options={[{ value: "any", label: "Anyone" }, ...people]}
      />
    </div>
  );
}
