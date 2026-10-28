"use client";

import { InboxIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { EmptyState } from "@/components/empty-state";
import { EntryList, EntryRow } from "@/components/entry-row";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { entriesLimitDefault } from "@/lib/report-layout";
import type { TimeEntry } from "@/lib/types";

export function EntriesCard({
  title,
  description,
  rows,
  limit = entriesLimitDefault,
  className,
}: {
  title: string;
  description?: string;
  rows?: TimeEntry[];
  limit?: number;
  className?: string;
}) {
  const entries = (rows ?? []).slice(0, limit);

  return (
    <Card className={cn("h-full gap-2 pb-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        <CardAction>
          <Link href="/entries" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            View all
          </Link>
        </CardAction>
      </CardHeader>
      {entries.length ? (
        <EntryList className="min-h-0 flex-1 overflow-auto border-t">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </EntryList>
      ) : (
        <CardContent className="pb-4">
          <EmptyState icon={InboxIcon} title="No entries yet" description="Start a timer or log hours you already worked." />
        </CardContent>
      )}
    </Card>
  );
}
