"use client";

import { CalendarRangeIcon, Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { SelectField } from "@/components/select-field";
import { Input } from "@/components/ui/input";
import { toDateOnly } from "@/lib/format";
import type { DateRange } from "@/lib/types";

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export function rangeFromSearch(search: { get: (key: string) => string | null }): DateRange {
  const from = search.get("from");
  const to = search.get("to");
  return {
    from: from && dateOnly.test(from) ? from : undefined,
    to: to && dateOnly.test(to) ? to : undefined,
  };
}

const presets = {
  all: "All time",
  week: "This week",
  month: "This month",
  last30: "Last 30 days",
  year: "This year",
  custom: "Custom range",
} as const;

type Preset = keyof typeof presets;

function rangeFor(preset: Preset): DateRange {
  const now = new Date();
  const start = new Date(now);
  switch (preset) {
    case "week":
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { from: toDateOnly(start) };
    case "month":
      return { from: toDateOnly(new Date(now.getFullYear(), now.getMonth(), 1)) };
    case "last30":
      start.setDate(now.getDate() - 29);
      return { from: toDateOnly(start) };
    case "year":
      return { from: toDateOnly(new Date(now.getFullYear(), 0, 1)) };
    default:
      return {};
  }
}

function presetFor(range: DateRange): Preset {
  if (!range.from && !range.to) return "all";
  if (range.to) return "custom";
  const match = (Object.keys(presets) as Preset[]).find(
    (key) => key !== "custom" && key !== "all" && rangeFor(key).from === range.from,
  );
  return match ?? "custom";
}

export function useUrlParams(params: Record<string, string | undefined>) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...changes })) {
      if (value) next.set(key, value);
    }

    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };
  return { update, pending };
}

export function DateRangeFilter({
  range,
  params = {},
}: {
  range: DateRange;
  params?: Record<string, string | undefined>;
}) {
  const { update, pending } = useUrlParams({ ...params, from: range.from, to: range.to });
  const preset = presetFor(range);

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        {pending ? (
          <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <CalendarRangeIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <SelectField
          className="sm:w-40"
          value={preset}
          onValueChange={(value) => {
            if (value === "custom") return;
            const next = rangeFor(value as Preset);
            update({ from: next.from, to: next.to });
          }}
          options={(Object.keys(presets) as Preset[]).map((key) => ({ value: key, label: presets[key] }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="date"
          aria-label="From"
          value={range.from ?? ""}
          max={range.to}
          onChange={(event) => update({ from: event.target.value || undefined })}
          className="sm:w-38"
        />
        <Input
          type="date"
          aria-label="To"
          value={range.to ?? ""}
          min={range.from}
          onChange={(event) => update({ to: event.target.value || undefined })}
          className="sm:w-38"
        />
      </div>
    </div>
  );
}
