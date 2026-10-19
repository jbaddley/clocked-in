import { cookies } from "next/headers";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { AppShell, ShellSkeleton } from "@/components/shell/app-shell";
import { WorkspaceProvider } from "@/hooks/use-workspace";
import { getQueryClient } from "@/lib/query-client";
import { getWorkspace } from "@/lib/server/dal";
import { prefetchOpenPunch } from "@/lib/server/prefetch";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

async function Workspace({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [workspace, store] = await Promise.all([getWorkspace(), cookies()]);
  await prefetchOpenPunch(queryClient, workspace.viewer.id);

  return (
    <WorkspaceProvider value={workspace}>
      <Hydrate client={queryClient}>
        <AppShell
          organization={workspace.organization}
          isAdmin={workspace.isAdmin}
          sidebarOpen={store.get("sidebar_state")?.value !== "false"}
        >
          {children}
        </AppShell>
      </Hydrate>
    </WorkspaceProvider>
  );
}
