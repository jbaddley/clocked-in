import { cn } from "cn";

const HOUR_TICKS = Array.from({ length: 12 }, (_, index) => index * 30);

export function ClockSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={cn("size-28 shrink-0 text-primary sm:size-32", className)}
    >
      {/* Outer bezel and clock face */}
      <circle cx="60" cy="60" r="56" className="fill-card stroke-primary/15" strokeWidth="2" />
      <circle cx="60" cy="60" r="50" className="fill-card stroke-current" strokeWidth="4" />

      {/* 12 hour markers around the dial */}
      <g transform="translate(60 60)">
        {HOUR_TICKS.map((angle, index) => {
          const major = index % 3 === 0;
          return (
            <line
              key={angle}
              x1="0"
              y1="-43"
              x2="0"
              y2={major ? "-35" : "-38.5"}
              transform={`rotate(${angle})`}
              strokeLinecap="round"
              strokeWidth={major ? "3.25" : "2"}
              className={major ? "stroke-current" : "stroke-muted-foreground/60"}
            />
          );
        })}

        {/* Hour hand */}
        <g className="animate-clock-hour">
          <line
            x1="0"
            y1="5"
            x2="0"
            y2="-22"
            strokeLinecap="round"
            strokeWidth="4.5"
            className="stroke-current"
          />
        </g>

        {/* Minute hand */}
        <g className="animate-clock-minute">
          <line
            x1="0"
            y1="6"
            x2="0"
            y2="-33"
            strokeLinecap="round"
            strokeWidth="3.25"
            className="stroke-current"
          />
        </g>

        {/* Ticking second hand */}
        <g className="animate-clock-second">
          <line
            x1="0"
            y1="10"
            x2="0"
            y2="-38"
            strokeLinecap="round"
            strokeWidth="2"
            className="stroke-[var(--brand-accent)]"
          />
        </g>

        {/* Center pivot cap */}
        <circle cx="0" cy="0" r="4.5" className="fill-current" />
        <circle cx="0" cy="0" r="2" className="fill-[var(--brand-accent)]" />
      </g>
    </svg>
  );
}

export function PageLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center gap-4 p-8 text-center",
        className,
      )}
    >
      <ClockSpinner />
      <p className="text-base font-medium tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

export function HeaderSkeleton() {
  return null;
}

export function StatsSkeleton() {
  return <PageLoader />;
}

export function CardSkeleton({ className }: { rows?: number; className?: string }) {
  return <PageLoader className={className} />;
}

export function DashboardSkeleton() {
  return <PageLoader />;
}

export function PageSkeleton({ className }: { rows?: number; className?: string }) {
  return <PageLoader className={className} />;
}

export function DesignerSkeleton() {
  return <PageLoader />;
}
