"use client";

import { BuildingIcon, ImageIcon, ListTreeIcon, MailIcon, NetworkIcon, PaletteIcon, ShieldIcon, UploadIcon, UsersIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";
import { useLabels } from "@/hooks/use-labels";
import { useWorkspace } from "@/hooks/use-workspace";

export function SettingsNav() {
  const copy = useLabels();
  const { isAdmin } = useWorkspace();
  const items = [
    { href: "/settings/organization", label: copy.organization, icon: BuildingIcon, admin: true },
    { href: "/settings/departments", label: copy.departments, icon: NetworkIcon, admin: true },
    { href: "/settings/lists", label: `${copy.projects} & lists`, icon: ListTreeIcon },
    { href: "/settings/members", label: "People", icon: UsersIcon },
    { href: "/settings/roles", label: "Roles", icon: ShieldIcon, admin: true },
    { href: "/settings/import", label: "Import", icon: UploadIcon, admin: true },
    { href: "/settings/theme", label: "Themes", icon: PaletteIcon, admin: true },
    { href: "/settings/brand", label: "Brand", icon: ImageIcon, admin: true },
    { href: "/settings/email", label: "Email", icon: MailIcon, admin: true },
  ];
  return <SectionNav items={items.filter((item) => !item.admin || isAdmin)} />;
}
