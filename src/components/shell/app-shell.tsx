import { AppSidebar } from "@/components/shell/app-sidebar";
import { HeaderTitle } from "@/components/shell/page-title";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { TimerChip } from "@/components/shell/timer-chip";
import { UserMenu } from "@/components/shell/user-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { brandAssetSrc, brandCss } from "@/lib/brand";
import type { Organization } from "@/lib/types";

export function AppShell({
  organization,
  isAdmin,
  sidebarOpen,
  children,
}: {
  organization: Organization | null;
  isAdmin: boolean;
  sidebarOpen: boolean;
  children: React.ReactNode;
}) {
  const css = brandCss(organization?.theme ?? null);
  const icon = organization ? brandAssetSrc("mark", organization.markUrl) : null;
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {css ? <style>{css}</style> : null}
      {icon ? <link rel="icon" href={icon} type="image/webp" /> : null}
      <AppSidebar organization={organization} isAdmin={isAdmin} />
      <SidebarInset className="min-w-0 bg-muted/40">
        <header className="sticky top-0 z-20 shrink-0 bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-3 md:px-4 lg:px-6">
            <div className="flex shrink-0 items-center gap-2">
              <SidebarTrigger className="size-9 md:hidden" />
              <OrgSwitcher />
            </div>
            <HeaderTitle />
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <TimerChip />
              <UserMenu />
            </div>
          </div>
          <div className="brand-rule" />
        </header>
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 bg-sidebar md:block" />
      <div className="flex flex-1 flex-col bg-muted/40">
        <div className="h-16 border-b bg-background" />
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
