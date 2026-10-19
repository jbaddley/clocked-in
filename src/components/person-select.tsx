"use client";

import { UserIcon } from "lucide-react";
import { SelectField } from "@/components/select-field";
import { useMembers } from "@/hooks/use-members";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Membership } from "@/lib/types";

export function selectableMembers(
  members: Membership[],
  viewerId: string,
  options?: { excludeSelf?: boolean; activeOnly?: boolean },
) {
  return members.filter((member) => {
    if (options?.activeOnly && member.isActive !== true) return false;
    if (options?.excludeSelf && member.userId === viewerId) return false;
    return true;
  });
}

export function PersonSelect({
  value,
  onValueChange,
  className,
  excludeSelf = false,
  activeOnly = false,
  placeholder,
}: {
  value: string;
  onValueChange: (userId: string) => void;
  className?: string;
  excludeSelf?: boolean;
  activeOnly?: boolean;
  placeholder?: string;
}) {
  const { viewer, isAdmin } = useWorkspace();
  const { members } = useMembers({ enabled: isAdmin });
  if (!isAdmin) return null;

  const options = selectableMembers(members, viewer.id, { excludeSelf, activeOnly }).map((member) => ({
    value: member.userId,
    label: member.userId === viewer.id ? `${member.user.username} (you)` : member.user.username,
  }));
  if (!excludeSelf && !activeOnly && !options.some((option) => option.value === viewer.id)) {
    options.unshift({ value: viewer.id, label: `${viewer.username} (you)` });
  }

  return (
    <div className="flex items-center gap-2">
      <UserIcon className="size-4 shrink-0 text-muted-foreground" />
      <SelectField
        className={className}
        value={value}
        onValueChange={onValueChange}
        options={options}
        placeholder={placeholder}
      />
    </div>
  );
}
