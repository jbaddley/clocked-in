"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/use-workspace";
import { invitationsQuery } from "@/lib/queries";

export function useInvitations() {
  const organization = useOrganization();
  const query = useQuery(invitationsQuery(organization.id));
  return { ...query, invitations: query.data ?? [] };
}
