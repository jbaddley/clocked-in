"use client";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLookups } from "@/hooks/use-lookups";
import { formatCurrency, formatMinutes, formatTime } from "@/lib/format";
import type { TimeEntry } from "@/lib/types";

const modeLabel: Record<string, string> = { Punch: "Timer", Duration: "Start / end", Total: "Total hours" };

export function EntryList({ className, children }: { className?: string; children: React.ReactNode }) {
  return <ul className={cn("@container divide-y", className)}>{children}</ul>;
}

export function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  onEdit?: (entry: TimeEntry) => void;
  onDelete?: (entry: TimeEntry) => void;
}) {
  const { names } = useLookups();
  const project = names.project.get(entry.projectId) ?? "Unclassified";
  const category = names.category.get(entry.taskCategoryId);
  const open = entry.durationMinutes === null;
  const when = entry.startedAt
    ? `${formatTime(entry.startedAt)} – ${entry.endedAt ? formatTime(entry.endedAt) : "now"}`
    : modeLabel[entry.mode];
  const value = entry.inKindValue !== null ? formatCurrency(entry.inKindValue) : "—";

  return (
    <li className="flex items-center gap-3 px-4 py-3 @3xl:gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{entry.description || project}</p>
        <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
          {[entry.description ? project : null, category].filter(Boolean).join(" · ")}
          <span className="@md:hidden">
            {" · "}
            {when} · {value}
          </span>
          {entry.enteredByUserId !== entry.userId ? " · entered by an admin" : null}
        </p>
      </div>
      <div className="hidden w-44 shrink-0 flex-wrap gap-1 @3xl:flex">
        {entry.tagIds.map((id) => (
          <Badge key={id} variant="outline" className="font-normal">
            {names.tag.get(id) ?? "tag"}
          </Badge>
        ))}
      </div>
      <p className="hidden w-36 shrink-0 text-right text-xs text-muted-foreground @md:block" suppressHydrationWarning>
        {when}
      </p>
      <p className={cn("w-16 shrink-0 text-right font-mono text-sm font-medium tabular-nums", open && "text-success")}>
        {open ? "Live" : formatMinutes(entry.durationMinutes)}
      </p>
      <p className="hidden w-20 shrink-0 text-right text-sm text-muted-foreground tabular-nums @md:block">{value}</p>
      {onEdit || onDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Entry actions" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit ? (
              <DropdownMenuItem onClick={() => onEdit(entry)}>
                <PencilIcon />
                Edit entry
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(entry)}>
                <Trash2Icon />
                Delete entry
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
