"use client";

import { useMemo, useState } from "react";
import { DynamicIcon, iconNames, type IconName } from "lucide-react/dynamic";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function iconLabel(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function IconPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const names = needle ? iconNames.filter((name) => name.includes(needle)) : iconNames;
    return names.slice(0, 120);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose an icon</DialogTitle>
          <DialogDescription>Search the Lucide icon set.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          aria-label="Search icons"
          placeholder="Search icons"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="grid max-h-80 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
          {matches.map((name) => (
            <Button
              key={name}
              type="button"
              variant="ghost"
              className="justify-start"
              onClick={() => {
                onSelect(name);
                onOpenChange(false);
                setQuery("");
              }}
            >
              <DynamicIcon name={name as IconName} />
              <span className="truncate">{iconLabel(name)}</span>
            </Button>
          ))}
        </div>
        {matches.length === 0 ? <p className="text-sm text-muted-foreground">No icons match that search.</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
