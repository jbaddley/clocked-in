import { BarChart3Icon, ClockIcon, LayoutDashboardIcon, ListChecksIcon, SettingsIcon, TimerIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { NavLink } from "@/components/shell/nav-link";
import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";
import type { Organization } from "@/lib/types";

const sections = [
  {
    label: "Track",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/log", label: "Log time", icon: TimerIcon },
      { href: "/groups", label: "Group time", icon: UsersIcon },
      { href: "/entries", label: "Entries", icon: ListChecksIcon },
    ],
  },
  { label: "Analyze", links: [{ href: "/reports", label: "Reports", icon: BarChart3Icon }] },
  { label: "Manage", admin: true, links: [{ href: "/settings", label: "Settings", icon: SettingsIcon }] },
];

export function AppSidebar({ organization, isAdmin }: { organization: Organization | null; isAdmin: boolean }) {
  const markUrl = organization?.markUrl;
  const wordmarkUrl = organization?.wordmarkUrl;
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center gap-0 overflow-hidden border-b border-sidebar-border px-2 py-0">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
          {markUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={markUrl} alt="" width={32} height={32} className="size-8 shrink-0 rounded-md object-contain" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <ClockIcon className="size-4" />
            </span>
          )}
          {wordmarkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wordmarkUrl}
              alt={organization?.name ?? "Organization"}
              height={28}
              className="h-7 max-w-36 object-contain group-data-[collapsible=icon]:hidden"
            />
          ) : (
            <span className="truncate font-heading text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              {organization?.name ?? "Clocked In"}
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="py-2">
        {sections
          .filter((section) => !section.admin || isAdmin)
          .map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className="text-[0.68rem] tracking-widest text-sidebar-foreground/60 uppercase">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.links.map((link) => (
                    <NavLink key={link.href} href={link.href} label={link.label}>
                      <link.icon />
                    </NavLink>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarFooter className="flex-row items-center gap-2">
        <SidebarToggle />
        <p className="min-w-0 truncate text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          Volunteer hours, valued for grants.
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
