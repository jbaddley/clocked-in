"use client";

import { createContext, useContext } from "react";
import type { RoleCode } from "@/lib/api/json";
import { isCoordinator } from "@/lib/roles";
import type { GroupDepartments, Organization, Viewer } from "@/lib/types";

export type Workspace = {
  viewer: Viewer;
  organizations: Organization[];
  organization: Organization | null;
  isAdmin: boolean;
  isCoordinator: boolean;
  canSelectRate: boolean;
  role: RoleCode | null;
  groupDepartments: GroupDepartments;
};

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ value, children }: { value: Workspace; children: React.ReactNode }) {
  return (
    <WorkspaceContext
      value={{
        ...value,
        isCoordinator: value.isCoordinator || isCoordinator(value.groupDepartments),
      }}
    >
      {children}
    </WorkspaceContext>
  );
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) {
    throw new Error("useWorkspace must be used inside the workspace layout.");
  }

  return workspace;
}

export function useOrganization() {
  const { organization } = useWorkspace();
  if (!organization) {
    throw new Error("This view needs an active organization.");
  }

  return organization;
}
