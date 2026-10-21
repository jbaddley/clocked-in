import {
  BarChart3Icon,
  BookOpenIcon,
  ClockIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquarePlusIcon,
  SettingsIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
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
import { brandAssetSrc, wordmarkSrc } from "@/lib/brand";
import type { Organization } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  admin?: boolean;
  coordinator?: boolean;
  superAdmin?: boolean;
};

const sections: { label: string; links: NavItem[] }[] = [
  {
    label: "Track",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/log", label: "Log time", icon: TimerIcon },
      { href: "/entries", label: "Entries", icon: ListChecksIcon },
    ],
  },
  { label: "Analyze", links: [{ href: "/reports", label: "Reports", icon: BarChart3Icon }] },
  {
    label: "Manage",
    links: [
      { href: "/about-prototype", label: "Guide", icon: BookOpenIcon, admin: true },
      { href: "/settings", label: "Settings", icon: SettingsIcon, admin: true, coordinator: true },
      { href: "/feedback", label: "Feedback", icon: MessageSquarePlusIcon, superAdmin: true },
    ],
  },
];

export function AppSidebar({
  organization,
  isAdmin,
  isCoordinator = false,
  isSuperAdmin,
}: {
  organization: Organization | null;
  isAdmin: boolean;
  isCoordinator?: boolean;
  isSuperAdmin: boolean;
}) {
  const markUrl = brandAssetSrc("mark", organization?.markUrl ?? null);
  const wordmarkUrl = wordmarkSrc(organization, "dark");
  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='h-16 flex-row items-center gap-0 overflow-hidden border-b border-sidebar-border px-2 py-0'>
        <Link href='/dashboard' className='flex min-w-0 items-center gap-2.5'>
          {markUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={markUrl} alt='' width={32} height={32} className='size-8 shrink-0 rounded-md object-contain' />
          ) : (
            <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
              <ClockIcon className='size-4' />
            </span>
          )}
          {wordmarkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wordmarkUrl}
              alt={organization?.name ?? "Organization"}
              height={28}
              className='h-7 max-w-36 object-contain group-data-[collapsible=icon]:hidden'
            />
          ) : (
            <span className='truncate font-heading text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden'>
              {organization?.name ?? "VolunTime"}
            </span>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className='py-2'>
        {sections
          .map((section) => ({
            ...section,
            links: section.links.filter(
              (link) =>
                (!link.admin || isAdmin || (link.coordinator && isCoordinator)) && (!link.superAdmin || isSuperAdmin),
            ),
          }))
          .filter((section) => section.links.length > 0)
          .map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel className='text-[0.68rem] tracking-widest text-sidebar-foreground/60 uppercase'>
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
      <SidebarFooter>
        <SidebarToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
