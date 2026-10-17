"use client";

import { BuildingIcon, ListTreeIcon, NetworkIcon, PaletteIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useLabels } from "@/hooks/use-labels";

export function SettingsNav() {
  const pathname = usePathname();
  const copy = useLabels();
  const items = [
    { href: "/settings/organization", label: copy.organization, icon: BuildingIcon },
    { href: "/settings/departments", label: copy.departments, icon: NetworkIcon },
    { href: "/settings/lists", label: `${copy.projects} & lists`, icon: ListTreeIcon },
    { href: "/settings/members", label: "People", icon: UsersIcon },
    { href: "/settings/theme", label: "Themes", icon: PaletteIcon },
  ];
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 border-b lg:flex-col lg:border-b-0">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors lg:rounded-lg lg:border-b-0",
                  active
                    ? "border-primary font-medium text-foreground lg:bg-card lg:shadow-xs lg:ring-1 lg:ring-foreground/10"
                    : "border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-card/60",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
