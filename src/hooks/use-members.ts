"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { membersQuery } from "@/lib/queries";

export function useMembers({ enabled = true }: { enabled?: boolean } = {}) {
  const organization = useOrganization();
  const query = useQuery({ ...membersQuery(organization.id), enabled });
  return { ...query, members: query.data ?? [] };
}

export function useCurrentMembership() {
  const { viewer } = useWorkspace();
  const { members } = useMembers();
  return members.find((member) => member.userId === viewer.id) ?? null;
}
