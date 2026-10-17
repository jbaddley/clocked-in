"use client";

import { useState } from "react";
import { useLookups } from "@/hooks/use-lookups";
import { useCurrentMembership } from "@/hooks/use-members";
import { useOrganization } from "@/hooks/use-workspace";
import type { Placement } from "@/app/actions/entries";

export const organizationWide = "organization";

type Choice = { departmentId?: string; projectId?: string; taskCategoryId?: string; tagIds: string[] };

export type PlacementPreference = {
  departmentId?: string;
  projectId?: string;
  taskCategoryId?: string;
  tagIds?: string[];
};

export function usePlacement(preferred?: PlacementPreference) {
  const organization = useOrganization();
  const { lookups } = useLookups();
  const membership = useCurrentMembership();
  const [choiceByOrg, setChoiceByOrg] = useState<Record<string, Choice>>(() =>
    preferred
      ? {
          [organization.id]: {
            tagIds: preferred.tagIds ?? [],
            departmentId: preferred.departmentId,
            projectId: preferred.projectId,
            taskCategoryId: preferred.taskCategoryId,
          },
        }
      : {},
  );
  const choice = choiceByOrg[organization.id] ?? { tagIds: [] };

  const departmentId = choice.departmentId ?? membership?.primaryDepartmentId ?? organizationWide;
  const projectId = choice.projectId ?? preferred?.projectId ?? lookups.projects[0]?.id ?? "";
  const taskCategoryId = choice.taskCategoryId ?? preferred?.taskCategoryId ?? lookups.categories[0]?.id ?? "";

  const placement = (description: string): Placement => ({
    organizationId: organization.id,
    departmentId: departmentId === organizationWide ? null : departmentId,
    projectId,
    taskCategoryId,
    description: description.trim() || null,
    tagIds: choice.tagIds,
  });

  return {
    lookups,
    ready: lookups.projects.length > 0 && lookups.categories.length > 0,
    value: { departmentId, projectId, taskCategoryId, tagIds: choice.tagIds },
    set: (patch: Partial<Choice>) =>
      setChoiceByOrg((current) => ({
        ...current,
        [organization.id]: { ...(current[organization.id] ?? { tagIds: [] }), ...patch },
      })),
    placement,
  };
}

export type PlacementState = ReturnType<typeof usePlacement>;
