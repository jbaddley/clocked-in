"use client";

import { PlusIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useClock } from "@/hooks/use-clock";
import { useElapsed, useOpenPunch } from "@/hooks/use-open-punch";
import { formatClock } from "@/lib/format";

export function TimerChip() {
  const { punch } = useOpenPunch();
  const elapsed = useElapsed(punch?.startedAt);
  const { clockOut } = useClock();

  if (!punch) {
    return (
      <Link href="/log/own" className={buttonVariants({ variant: "ghost", className: "h-9 gap-2" })}>
        <PlusIcon className="text-primary" />
        <span className="hidden sm:inline">Add Time</span>
      </Link>
    );
  }

  return (
    <div className="flex h-9 items-center gap-1 rounded-full border bg-card pr-1 pl-3 shadow-xs">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-success" />
      </span>
      <Link href="/log/own" className="px-1.5 font-mono text-sm tabular-nums" suppressHydrationWarning>
        {formatClock(elapsed)}
      </Link>
      <Button
        size="icon-sm"
        variant="destructive"
        className="rounded-full"
        aria-label="Stop timer"
        disabled={clockOut.isPending}
        onClick={() => clockOut.mutate({})}
      >
        <SquareIcon className="fill-current" />
      </Button>
    </div>
  );
}
