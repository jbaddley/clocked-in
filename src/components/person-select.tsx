"use client";

import { UserIcon } from "lucide-react";
import { SelectField } from "@/components/select-field";
import { useMembers } from "@/hooks/use-members";
import { useWorkspace } from "@/hooks/use-workspace";

export function PersonSelect({
  value,
  onValueChange,
  className,
}: {
  value: string;
  onValueChange: (userId: string) => void;
  className?: string;
}) {
  const { viewer, isAdmin } = useWorkspace();
  const { members } = useMembers({ enabled: isAdmin });
  if (!isAdmin) return null;

  const options = members.map((member) => ({
    value: member.userId,
    label: member.userId === viewer.id ? `${member.user.username} (you)` : member.user.username,
  }));
  if (!options.some((option) => option.value === viewer.id)) {
    options.unshift({ value: viewer.id, label: `${viewer.username} (you)` });
  }

  return (
    <div className="flex items-center gap-2">
      <UserIcon className="size-4 shrink-0 text-muted-foreground" />
      <SelectField className={className} value={value} onValueChange={onValueChange} options={options} />
    </div>
  );
}
