"use client";

import type { LucideIcon } from "lucide-react";
import { LockIcon, UserRoundIcon } from "lucide-react";
import { cn } from "cn";

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
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain">
      <ul className="flex gap-1 border-b lg:flex-col lg:border-b-0">
        {items.map((item) => {
          const active = section === item.id;
          return (
            <li key={item.id} className="shrink-0">
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSection(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm whitespace-nowrap transition-colors max-lg:border-b-2 lg:rounded-lg lg:border",
                  active
                    ? "border-primary font-medium text-foreground lg:border-foreground/10 lg:bg-card lg:shadow-xs"
                    : "border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-card/60",
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
  );
}
