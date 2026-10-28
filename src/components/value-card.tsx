import Link from "next/link";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { cn } from "cn";
import { Card } from "@/components/ui/card";
import { formatWithPattern } from "@/lib/number-pattern";
import type { ValueColor } from "@/lib/report-layout";

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

function displayValue(value: unknown, pattern: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return formatWithPattern(value, pattern);
}

export function ValueCard({
  title,
  description,
  value,
  color,
  pattern,
  icon,
  className,
  href,
}: {
  title: string;
  description?: string;
  value?: unknown;
  color: ValueColor;
  pattern: string;
  icon?: string | null;
  className?: string;
  href?: string;
}) {
  const style = tones[color];
  const body = (
    <Card className="h-full w-full flex-row items-center gap-4 px-4">
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", style.badge)}>
        {icon ? <DynamicIcon name={icon as IconName} className="size-5" /> : null}
      </div>
      <div className="min-w-0">
        <p className={cn("truncate text-xs font-medium tracking-wide uppercase", style.text)}>{title}</p>
        <p className="truncate text-2xl font-semibold text-foreground tabular-nums">{displayValue(value, pattern)}</p>
        {description ? <p className={cn("truncate text-xs", style.text)}>{description}</p> : null}
      </div>
    </Card>
  );
  if (!href) {
    return <div className={cn("h-full w-full", className)}>{body}</div>;
  }
  return (
    <Link href={href} className={cn("block h-full w-full", className)}>
      {body}
    </Link>
  );
}
