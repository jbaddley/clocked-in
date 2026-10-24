"use client";

import { BracesIcon, KeyRoundIcon, PlugIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";

export function DeveloperNav() {
  return (
    <SectionNav
      items={[
        { href: "/developer/api-keys", label: "API keys", icon: KeyRoundIcon },
        { href: "/developer/mcp", label: "MCP", icon: PlugIcon },
        { href: "/developer/api", label: "API", icon: BracesIcon },
      ]}
    />
  );
}
