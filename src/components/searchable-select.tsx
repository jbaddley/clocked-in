"use client";

import { Combobox } from "@base-ui/react/combobox";
import { cn } from "cn";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { useMemo } from "react";
import type { Option } from "@/components/select-field";

type Item = { value: string; label: string };
type Group = { value: string; items: Item[] };

function groupsFrom(options: Option[]): Group[] {
  const groups: Group[] = [];
  const index = new Map<string, Group>();
  for (const option of options) {
    const name = option.group ?? "";
    let group = index.get(name);
    if (!group) {
      group = { value: name, items: [] };
      index.set(name, group);
      groups.push(group);
    }
    group.items.push({ value: option.value, label: option.label });
  }
  return groups;
}

export function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search",
  emptyLabel = "No matches",
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const groups = useMemo(() => groupsFrom(options), [options]);
  const items = useMemo(
    () =>
      Combobox.createItems<Item, string>(groups, {
        getValue: (item) => item.value,
        getLabel: (item) => item.label,
      }),
    [groups],
  );
  const grouped = groups.some((group) => group.value !== "");

  return (
    <Combobox.Root
      items={items}
      value={value || null}
      onValueChange={(next) => onValueChange(next ?? "")}
      disabled={disabled}
      autoHighlight
    >
      <Combobox.Trigger
        id={id}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          <Combobox.Value placeholder={placeholder} />
        </span>
        <Combobox.Icon className="text-muted-foreground">
          <ChevronDownIcon />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50" sideOffset={4} align="start">
          <Combobox.Popup className="flex max-h-(--available-height) w-max min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex shrink-0 items-center gap-1.5 border-b px-2">
              <SearchIcon className="size-3.5 text-muted-foreground" />
              <Combobox.Input
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoComplete="off"
                className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
              />
            </div>
            <Combobox.Empty>
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto p-1 outline-none">
              {(group: Group) => (
                <Combobox.Group key={group.value || "items"} items={group.items} className="p-1">
                  {grouped && group.value ? (
                    <Combobox.GroupLabel className="sticky top-0 z-10 bg-popover px-1.5 pt-1.5 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {group.value}
                    </Combobox.GroupLabel>
                  ) : null}
                  <Combobox.Collection>
                    {(item: Item) => (
                      <Combobox.Item
                        key={item.value}
                        value={item.value}
                        className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      >
                        <span className="whitespace-nowrap">{item.label}</span>
                        <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                          <CheckIcon className="size-4" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
