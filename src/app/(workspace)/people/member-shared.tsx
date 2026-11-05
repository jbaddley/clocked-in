"use client";

import { useQuery } from "@tanstack/react-query";
import { Field } from "@/components/field";
import { Checkbox } from "@/components/ui/checkbox";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useOrganization } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/fetch-json";
import type { Membership, Paged } from "@/lib/types";


export const fallbackRoles = [
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "MEMBER", label: "Staff" },
  { value: "ADMIN", label: "Admin" },
];

export function roleLabel(code: string, fallback: string) {
  return fallbackRoles.find((role) => role.value === code)?.label ?? fallback;
}

export function useOrgRoleOptions() {
  const organization = useOrganization();
  const { data } = useQuery({
    queryKey: ["org", organization.id, "roles"],
    queryFn: ({ signal }) =>
      fetchJson<Paged<{ code: string; name: string }>>(`/organizations/${organization.id}/roles?limit=100`, signal),
  });
  const items = data?.items ?? [];
  if (items.length === 0) return fallbackRoles;
  return items.map((role) => ({
    value: role.code,
    label: role.name,
  }));
}

export function departmentNames(member: Membership, departments: { id: string; name: string }[]) {
  return (member.departmentIds ?? [])
    .map((id) => departments.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useUsernamePreview(firstName: string, lastName: string) {
  return useQuery({
    queryKey: ["username-preview", firstName, lastName],
    queryFn: ({ signal }) =>
      fetchJson<{ username: string; base: string; collided: boolean }>(
        `/usernames/preview?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`,
        signal,
      ),
    enabled: firstName.trim().length > 0 && lastName.trim().length > 0,
  });
}

export type GroupAssignment = { departmentId: string; manager: boolean };

export function DepartmentChecks({
  value,
  onChange,
}: {
  value: GroupAssignment[];
  onChange: (value: GroupAssignment[]) => void;
}) {
  const { lookups } = useLookups();
  const copy = useLabels();
  if (lookups.departments.length === 0) {
    return <p className="text-sm text-muted-foreground">No {copy.departments.toLowerCase()} yet.</p>;
  }

  return (
    <Field label={copy.departments}>
      <ul className="grid gap-3">
        {lookups.departments.map((department) => {
          const assignment = value.find((item) => item.departmentId === department.id);
          return (
            <li key={department.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={Boolean(assignment)}
                  onCheckedChange={(next) => {
                    onChange(
                      next === true
                        ? [...value, { departmentId: department.id, manager: false }]
                        : value.filter((item) => item.departmentId !== department.id),
                    );
                  }}
                />
                {department.name}
              </label>
              {assignment ? (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={assignment.manager}
                    onCheckedChange={(next) => {
                      onChange(
                        value.map((item) =>
                          item.departmentId === department.id ? { ...item, manager: next === true } : item,
                        ),
                      );
                    }}
                  />
                  Group manager
                </label>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Field>
  );
}
