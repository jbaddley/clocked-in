"use client";

import { LockIcon, UserRoundIcon } from "lucide-react";
import { SectionNav } from "@/components/section-nav";

export type ProfileSection = "about" | "password";

const items = [
  { id: "about" as const, label: "About you", icon: UserRoundIcon },
  { id: "password" as const, label: "Password", icon: LockIcon },
];

export function ProfileNav({
  section,
  onSection,
}: {
  section: ProfileSection;
  onSection: (section: ProfileSection) => void;
}) {
  return <SectionNav<ProfileSection> items={items} value={section} onValueChange={onSection} label="Profile sections" />;
}
