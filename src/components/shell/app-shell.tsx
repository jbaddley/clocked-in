import { AppSidebar } from "@/components/shell/app-sidebar";
import { ShellFrame } from "@/components/shell/shell-frame";
import { OrgFavicon } from "@/components/shell/org-favicon";
import { HeaderTitle } from "@/components/shell/page-title";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { FeedbackButton } from "@/components/shell/feedback-button";
import { TimerChip } from "@/components/shell/timer-chip";
import { UserMenu } from "@/components/shell/user-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { brandCss } from "@/lib/brand";
import { orgMarkIcon } from "@/lib/favicon";
import type { Organization } from "@/lib/types";

export function AppShell({
  organization,
  isAdmin,
  isCoordinator = false,
  isSuperAdmin,
  showReports,
  sidebarOpen,
  children,
}: {
  organization: Organization | null;
  isAdmin: boolean;
  isCoordinator?: boolean;
  isSuperAdmin: boolean;
  showReports: boolean;
  sidebarOpen: boolean;
  children: React.ReactNode;
}) {
  const css = brandCss(organization?.theme ?? null);
  const icon = organization ? (orgMarkIcon(organization.markUrl)?.url ?? null) : null;
  return (
    <SidebarProvider defaultOpen={sidebarOpen} className="h-svh overflow-hidden">
      {css ? <style>{css}</style> : null}
      <OrgFavicon href={icon} />
      <AppSidebar
        organization={organization}
        isAdmin={isAdmin}
        isCoordinator={isCoordinator}
        isSuperAdmin={isSuperAdmin}
        showReports={showReports}
      />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden bg-muted/40">
        <header className="sticky top-0 z-20 shrink-0 bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center gap-2 px-3 md:px-4 lg:px-6">
            <div className="flex shrink-0 items-center gap-2">
              <SidebarTrigger className="size-9 md:hidden" />
              <OrgSwitcher />
            </div>
            <HeaderTitle />
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
              <TimerChip />
              <FeedbackButton />
              <UserMenu />
            </div>
          </div>
          <div className="brand-rule" />
        </header>
        <ShellFrame>{children}</ShellFrame>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 bg-sidebar md:block" />
      <div className="flex flex-1 flex-col bg-muted/40">
        <div className="flex h-16 items-center gap-3 bg-background px-3 md:px-4 lg:px-6">
          <div className="h-9 w-40 animate-pulse rounded-md bg-muted" />
          <div className="hidden h-8 w-48 animate-pulse rounded-md bg-muted lg:block" />
          <div className="ml-auto size-9 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="brand-rule" />
        <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted lg:hidden" />
        </div>
      </div>
    </div>
  );
}
