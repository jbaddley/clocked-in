"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function SectionNav({ items }: { items: { href: string; label: string; icon: LucideIcon }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain">
      <ul className="flex gap-1 border-b lg:flex-col lg:border-b-0">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition-colors max-lg:border-b-2 lg:rounded-lg lg:border",
                  active
                    ? "border-primary font-medium text-foreground lg:border-foreground/10 lg:bg-card lg:shadow-xs"
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
