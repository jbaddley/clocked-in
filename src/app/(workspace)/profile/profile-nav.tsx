"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDownIcon, LockIcon, UserRoundIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const items: { id: ProfileSection; label: string; icon: LucideIcon }[] = [
  { id: "about", label: "About you", icon: UserRoundIcon },
  { id: "password", label: "Password", icon: LockIcon },
];

export type ProfileSection = "about" | "password";

export function ProfileNav({
  section,
  onSection,
}: {
  section: ProfileSection;
  onSection: (section: ProfileSection) => void;
}) {
  const active = items.find((item) => item.id === section) ?? items[0];

  return (
    <>
      <nav aria-label="Profile sections" className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="outline" className="h-9 w-full justify-between px-3 font-medium" />}
          >
            <span className="flex min-w-0 items-center gap-2">
              <active.icon />
              <span className="truncate">{active.label}</span>
            </span>
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-(--anchor-width)">
            {items.map((item) => {
              const current = item.id === section;
              return (
                <DropdownMenuItem
                  key={item.id}
                  className={cn(current && "bg-accent font-medium text-accent-foreground")}
                  onClick={() => onSection(item.id)}
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
            const current = section === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={current ? "page" : undefined}
                  onClick={() => onSection(item.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
                    current
                      ? "border-foreground/10 bg-card font-medium text-foreground shadow-xs"
                      : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
