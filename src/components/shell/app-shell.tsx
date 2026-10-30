import { AppSidebar } from "@/components/shell/app-sidebar";
import { ShellFrame } from "@/components/shell/shell-frame";
import { OrgFavicon } from "@/components/shell/org-favicon";
import { HeaderTitle } from "@/components/shell/page-title";
import { OrgSwitcher } from "@/components/shell/org-switcher";
import { FeedbackButton } from "@/components/shell/feedback-button";
import { TimerChip } from "@/components/shell/timer-chip";
import { UserMenu } from "@/components/shell/user-menu";
import { PageLoader } from "@/components/skeletons";
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
  isTenantHost = false,
  pinnedOrganizationName = null,
  children,
}: {
  organization: Organization | null;
  isAdmin: boolean;
  isCoordinator?: boolean;
  isSuperAdmin: boolean;
  showReports: boolean;
  sidebarOpen: boolean;
  isTenantHost?: boolean;
  pinnedOrganizationName?: string | null;
  children: React.ReactNode;
}) {
  const css = brandCss(organization?.theme ?? null);
  const icon = organization ? (orgMarkIcon(organization.markUrl)?.url ?? null) : null;
  const tenantLabel = organization?.name ?? pinnedOrganizationName;
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
              {isTenantHost ? (
                tenantLabel ? (
                  <span className="max-w-56 truncate px-2 text-sm font-medium sm:max-w-72">{tenantLabel}</span>
                ) : null
              ) : (
                <OrgSwitcher />
              )}
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
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40">
      <PageLoader className="min-h-svh" />
    </div>
  );
}
