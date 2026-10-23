import { Suspense } from "react";
import { ShellSkeleton } from "@/components/shell/app-shell";
import { WorkspaceShell } from "@/components/shell/workspace-shell";

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </Suspense>
  );
}
