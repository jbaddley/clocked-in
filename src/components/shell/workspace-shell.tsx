import { cookies } from "next/headers";
import { OrganizationGate } from "@/components/organization-gate";
import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";

export async function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const [workspace, store] = await Promise.all([getWorkspace(), cookies()]);

  return (
    <WorkspaceProvider value={workspace}>
      <AppShell
        organization={workspace.organization}
        isAdmin={workspace.isAdmin}
        isCoordinator={workspace.isCoordinator}
        isSuperAdmin={workspace.viewer.isSuperAdmin}
        showReports={canSeeReports(workspace)}
        sidebarOpen={store.get("sidebar_state")?.value !== "false"}
      >
        <OrganizationGate>{children}</OrganizationGate>
      </AppShell>
    </WorkspaceProvider>
  );
}
