import { ClockIcon, HandCoinsIcon, ListChecksIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { ValueColor, ValueFormat, ValueIcon } from "@/lib/report-layout";

const tones: Record<ValueColor, { badge: string; text: string }> = {
  primary: {
    badge: "bg-primary text-primary-foreground",
    text: "text-primary",
  },
  highlight: {
    badge: "bg-highlight text-primary",
    text: "text-[oklch(from_var(--highlight)_0.45_c_h)]",
  },
  accent: {
    badge: "bg-brand-accent text-primary",
    text: "text-[oklch(from_var(--brand-accent)_0.45_c_h)]",
  },
  success: {
    badge: "bg-success text-primary",
    text: "text-[oklch(from_var(--success)_0.45_c_h)]",
  },
};

const icons: Record<ValueIcon, LucideIcon> = {
  clock: ClockIcon,
  "hand-coins": HandCoinsIcon,
  users: UsersIcon,
  "list-checks": ListChecksIcon,
};

function displayValue(value: unknown, format: ValueFormat) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return format === "currency" ? formatCurrency(value) : formatNumber(value);
}

export function ValueCard({
  title,
  description,
  value,
  color,
  format,
  icon,
  className,
}: {
  title: string;
  description?: string;
  value?: unknown;
  color: ValueColor;
  format: ValueFormat;
  icon?: ValueIcon | null;
  className?: string;
}) {
  const style = tones[color];
  const Icon = icon ? icons[icon] : null;
  return (
    <Card className={cn("h-full w-full flex-row items-center gap-4 px-4", className)}>
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", style.badge)}>
        {Icon ? <Icon className="size-5" /> : null}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate text-xs font-medium tracking-wide uppercase", style.text)}>{title}</p>
        <p className="truncate text-2xl font-semibold text-foreground tabular-nums">{displayValue(value, format)}</p>
        {description ? <p className={cn("truncate text-xs", style.text)}>{description}</p> : null}
      </div>
    </Card>
  );
}
