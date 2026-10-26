"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SectionNav({ items }: { items: { href: string; label: string; icon: LucideIcon }[] }) {
  const pathname = usePathname();
  const active = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? items[0];

  return (
    <>
      <nav aria-label="Sections" className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="outline" className="h-9 w-full justify-between px-3 font-medium" />}
          >
            {active ? (
              <span className="flex min-w-0 items-center gap-2">
                <active.icon />
                <span className="truncate">{active.label}</span>
              </span>
            ) : null}
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--anchor-width)">
            {items.map((item) => {
              const current = item.href === active?.href;
              return (
                <DropdownMenuItem
                  key={item.href}
                  className={cn(current && "bg-accent font-medium text-accent-foreground")}
                  render={<Link href={item.href} aria-current={current ? "page" : undefined} />}
                >
                  <item.icon />
                  {item.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <nav className="hidden min-h-0 overflow-y-auto overscroll-y-contain lg:block">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm whitespace-nowrap transition-colors",
                    current
                      ? "border-foreground/10 bg-card font-medium text-foreground shadow-xs"
                      : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
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
    </>
  );
}
