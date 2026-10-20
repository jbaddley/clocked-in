import { cookies } from "next/headers";
import { Suspense } from "react";
import { OrganizationGate } from "@/components/organization-gate";
import { AppShell, ShellSkeleton } from "@/components/shell/app-shell";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { getWorkspace } from "@/lib/server/dal";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

async function Workspace({ children }: { children: React.ReactNode }) {
  const [workspace, store] = await Promise.all([getWorkspace(), cookies()]);

  return (
    <WorkspaceProvider value={workspace}>
      <AppShell
        organization={workspace.organization}
        isAdmin={workspace.isAdmin}
        isSuperAdmin={workspace.viewer.isSuperAdmin}
        sidebarOpen={store.get("sidebar_state")?.value !== "false"}
      >
        <OrganizationGate>{children}</OrganizationGate>
      </AppShell>
    </WorkspaceProvider>
  );
}
