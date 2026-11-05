"use client";

import { ShieldIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";
import { useWorkspace } from "@/hooks/use-workspace";

export function PeopleNav() {
  const { isAdmin } = useWorkspace();
  const items = [
    { href: "/people", label: "People", icon: UsersIcon, exact: true },
    { href: "/people/invites", label: "Invites", icon: UserPlusIcon },
    { href: "/people/roles", label: "Roles", icon: ShieldIcon, admin: true },
  ];

  return <SectionNav items={items.filter((item) => !item.admin || isAdmin)} />;
}
