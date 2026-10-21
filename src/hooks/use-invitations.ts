"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { departmentInvitationsQuery, invitationsQuery } from "@/lib/queries";
import type { Invitation } from "@/lib/types";

export function useInvitations() {
  const organization = useOrganization();
  const { isAdmin, isCoordinator, groupDepartments } = useWorkspace();
  const departmentIds = isCoordinator && groupDepartments !== "all" ? groupDepartments : [];
  const orgQuery = useQuery({ ...invitationsQuery(organization.id), enabled: isAdmin });
  const departmentQueries = useQueries({
    queries: departmentIds.map((departmentId) => ({
      ...departmentInvitationsQuery(departmentId),
      enabled: isCoordinator,
    })),
  });
  const invitations: Invitation[] = isAdmin
    ? (orgQuery.data ?? [])
    : departmentQueries.flatMap((query) => query.data ?? []);
  return { invitations, isPending: isAdmin ? orgQuery.isPending : departmentQueries.some((query) => query.isPending) };
}
