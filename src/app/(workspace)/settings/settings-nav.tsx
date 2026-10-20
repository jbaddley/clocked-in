"use client";

import { BuildingIcon, ImageIcon, KeyRoundIcon, ListTreeIcon, NetworkIcon, PaletteIcon, UsersIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";
import { useLabels } from "@/hooks/use-labels";

export function SettingsNav() {
  const copy = useLabels();
  return (
    <SectionNav
      items={[
        { href: "/settings/organization", label: copy.organization, icon: BuildingIcon },
        { href: "/settings/api-keys", label: "API keys", icon: KeyRoundIcon },
        { href: "/settings/departments", label: copy.departments, icon: NetworkIcon },
        { href: "/settings/lists", label: `${copy.projects} & lists`, icon: ListTreeIcon },
        { href: "/settings/members", label: "People", icon: UsersIcon },
        { href: "/settings/theme", label: "Themes", icon: PaletteIcon },
        { href: "/settings/brand", label: "Brand", icon: ImageIcon },
      ]}
    />
  );
}
