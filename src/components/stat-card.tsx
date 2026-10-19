import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Card } from "@/components/ui/card";

const tones = {
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
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  const style = tones[tone];
  return (
    <Card className="flex-row items-center gap-4 px-4">
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", style.badge)}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className={cn("text-xs font-medium tracking-wide uppercase", style.text)}>{label}</p>
        <p className="truncate text-2xl font-semibold text-foreground tabular-nums">{value}</p>
        {hint ? <p className={cn("truncate text-xs", style.text)}>{hint}</p> : null}
      </div>
    </Card>
  );
}
