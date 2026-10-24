"use client";

import { useQuery } from "@tanstack/react-query";
import { Link2Icon, TimerIcon, UserRoundIcon, UsersIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";
import { useWorkspace } from "@/hooks/use-workspace";
import { connectionsQuery } from "@/lib/queries";
import { canLogConnectionTime, canLogGroupTime, canLogMemberTime } from "@/lib/roles";

export function LogNav() {
  const { isAdmin, role, groupDepartments, organization } = useWorkspace();
  const connections = useQuery({
    ...connectionsQuery(organization?.id ?? ""),
    enabled: Boolean(organization),
  });
  const showConnections = organization
    ? canLogConnectionTime({
        role,
        isAdmin,
        allowVolunteersToAddVolunteers: organization.preferences.allowVolunteersToAddVolunteers,
        connectionCount: connections.data?.length ?? 0,
      })
    : false;
  const items = [
    { href: "/log/own", label: "Log Own Time", icon: TimerIcon },
    ...(canLogMemberTime(isAdmin, groupDepartments) ? [{ href: "/log/member", label: "Log Member Time", icon: UserRoundIcon }] : []),
    ...(showConnections ? [{ href: "/log/connections", label: "Log Connection Time", icon: Link2Icon }] : []),
    ...(canLogGroupTime(groupDepartments) ? [{ href: "/log/group", label: "Log Group Time", icon: UsersIcon }] : []),
  ];
  return <SectionNav items={items} />;
}
