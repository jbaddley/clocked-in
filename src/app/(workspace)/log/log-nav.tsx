"use client";

import { TimerIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";
import { useWorkspace } from "@/hooks/use-workspace";
import { canLogGroupTime } from "@/lib/roles";

export function LogNav() {
  const { isAdmin, groupDepartments } = useWorkspace();
  const items = [
    { href: "/log/own", label: "Log Own Time", icon: TimerIcon },
    ...(isAdmin ? [{ href: "/log/member", label: "Log Member Time", icon: UserRoundIcon }] : []),
    ...(canLogGroupTime(groupDepartments) ? [{ href: "/log/group", label: "Log Group Time", icon: UsersIcon }] : []),
  ];
  return <SectionNav items={items} />;
}
