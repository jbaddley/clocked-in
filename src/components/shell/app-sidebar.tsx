import {
  BarChart3Icon,
  BookOpenIcon,
  Code2Icon,
  HandHeartIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquarePlusIcon,
  SettingsIcon,
  TimerIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/components/shell/nav-link";
import { OrgSwitcher } from "@/components/shell/org-switcher";
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

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  excludePrefix?: string;
  admin?: boolean;
  coordinator?: boolean;
  superAdmin?: boolean;
  reports?: boolean;
};

const sections: { label: string; bottom?: boolean; links: NavItem[] }[] = [
  {
    label: "Workspace",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/log", label: "Log time", icon: TimerIcon },
      { href: "/entries", label: "Entries", icon: ListChecksIcon },
      { href: "/reports", label: "Reports", icon: BarChart3Icon, reports: true },
    ],
  },
  {
    label: "Manage",
    links: [
      { href: "/needs", label: "Needs", icon: HandHeartIcon, admin: true, coordinator: true },
      { href: "/people", label: "People", icon: UsersIcon, admin: true, coordinator: true },
      {
        href: "/settings",
        label: "Settings",
        icon: SettingsIcon,
        admin: true,
        coordinator: true,
      },
    ],
  },
  {
    label: "Resources",
    bottom: true,
    links: [
      { href: "/about-prototype", label: "Guide", icon: BookOpenIcon, admin: true },
      { href: "/developer", label: "Developer", icon: Code2Icon, admin: true },
      { href: "/feedback", label: "Feedback", icon: MessageSquarePlusIcon, superAdmin: true },
    ],
  },
];

export function AppSidebar({
  isAdmin,
  isCoordinator = false,
  isSuperAdmin,
  showReports,
}: {
  isAdmin: boolean;
  isCoordinator?: boolean;
  isSuperAdmin: boolean;
  showReports: boolean;
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center gap-0 overflow-hidden border-b border-sidebar-border px-2 py-0 group-data-[collapsible=icon]:pl-1 group-data-[collapsible=icon]:pr-0.5">
        <OrgSwitcher />
      </SidebarHeader>
      <SidebarContent className="py-2">
        {sections
          .map((section) => ({
            ...section,
            links: section.links.filter(
              (link) =>
                (!link.admin || isAdmin || (link.coordinator && isCoordinator)) &&
                (!link.superAdmin || isSuperAdmin) &&
                (!link.reports || showReports),
            ),
          }))
          .filter((section) => section.links.length > 0)
          .map((section) => (
            <SidebarGroup key={section.label} className={section.bottom ? "mt-auto" : undefined}>
              <SidebarGroupLabel className="text-[0.68rem] tracking-widest text-sidebar-foreground/60 uppercase">
                {section.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.links.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      label={link.label}
                      excludePrefix={link.excludePrefix}
                    >
                      <link.icon />
                    </NavLink>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
