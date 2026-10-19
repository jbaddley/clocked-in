"use client";

import { CalendarClockIcon, PlayIcon, SquareIcon, TimerIcon } from "lucide-react";
import { useState } from "react";
import { TimeEntryDialog, TimeEntryForm } from "@/components/entity-forms/time-entry-form";
import { EntryList, EntryRow } from "@/components/entry-row";
import { PlacementFields } from "@/components/placement-fields";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useClock } from "@/hooks/use-clock";
import { useEntries } from "@/hooks/use-entries";
import { useLookups } from "@/hooks/use-lookups";
import { useElapsed, useOpenPunch } from "@/hooks/use-open-punch";
import { usePlacement } from "@/hooks/use-placement";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatClock, formatTime, today } from "@/lib/format";
import type { TimeEntry } from "@/lib/types";
import { SetupAlert } from "../setup-alert";

export function OwnTimeView() {
  const { isAdmin } = useWorkspace();
  const { lookups } = useLookups();
  const missingProject = lookups.projects.length === 0;
  const missingCategory = lookups.categories.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {missingProject || missingCategory ? (
        <SetupAlert
          isAdmin={isAdmin}
          missingProject={missingProject}
          missingCategory={missingCategory}
          action="start a timer or save time"
        />
      ) : null}
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <TimerCard />
          <ManualEntryCard />
        </div>
        <TodayCard />
      </div>
    </div>
  );
}

function TimerCard() {
  const { punch } = useOpenPunch();
  const elapsed = useElapsed(punch?.startedAt);
  const { names } = useLookups();
  const { clockIn, clockOut } = useClock();
  const placement = usePlacement();
  const [description, setDescription] = useState("");
  const running = Boolean(punch);
  const canStart = placement.ready;

  return (
    <Card className="gap-0 py-0">
      <form
        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          if (running) {
            clockOut.mutate(description.trim() ? { description: description.trim() } : {}, {
              onSuccess: () => setDescription(""),
            });
          } else if (canStart) {
            clockIn.mutate(placement.placement(description));
          }
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TimerIcon className="size-5 shrink-0 text-muted-foreground" />
          {running && punch ? (
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{punch.description || names.project.get(punch.projectId) || "Running timer"}</p>
              <p className="truncate text-xs text-muted-foreground" suppressHydrationWarning>
                Started {formatTime(punch.startedAt)} · {names.category.get(punch.taskCategoryId)}
              </p>
            </div>
          ) : (
            <Input
              aria-label="What are you working on?"
              placeholder="What are you working on?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="h-10 border-0 px-0 text-base shadow-none focus-visible:ring-0 md:text-base"
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="font-mono text-2xl font-semibold tabular-nums" suppressHydrationWarning>
            {formatClock(elapsed)}
          </span>
          <Button
            type="submit"
            size="lg"
            variant={running ? "destructive" : "default"}
            className="h-10 min-w-32"
            disabled={clockIn.isPending || clockOut.isPending || (!running && !canStart)}
          >
            {running ? <SquareIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
            {running ? "Stop" : "Start timer"}
          </Button>
        </div>
      </form>
      {!running ? (
        <div className="border-t bg-muted/30 p-4">
          <PlacementFields state={placement} compact />
        </div>
      ) : null}
    </Card>
  );
}

function ManualEntryCard() {
  const { viewer } = useWorkspace();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClockIcon className="size-4 text-muted-foreground" />
          Add time manually
        </CardTitle>
        <CardDescription>Add a start time, then an end time or a duration.</CardDescription>
      </CardHeader>
      <CardContent>
        <TimeEntryForm userId={viewer.id} />
      </CardContent>
    </Card>
  );
}

function TodayCard() {
  const { viewer } = useWorkspace();
  const day = today();
  const { entries, isPending } = useEntries(viewer.id, { from: day, to: day });
  const [pendingEdit, setPendingEdit] = useState<TimeEntry | null>(null);
  const total = entries.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);

  return (
    <Card className="h-fit pb-0">
      <CardHeader>
        <CardTitle>Today</CardTitle>
        <CardDescription>Your entries for today</CardDescription>
        <CardAction className="font-mono text-lg font-semibold tabular-nums">
          {String(Math.floor(total / 60)).padStart(2, "0")}:{String(total % 60).padStart(2, "0")}
        </CardAction>
      </CardHeader>
      {entries.length ? (
        <EntryList className="border-t">
          {entries.map((entry: TimeEntry) => (
            <EntryRow key={entry.id} entry={entry} onEdit={setPendingEdit} />
          ))}
        </EntryList>
      ) : (
        <CardContent className="pb-4 text-sm text-muted-foreground">
          {isPending ? "Loading…" : "Nothing logged yet today."}
        </CardContent>
      )}
      <TimeEntryDialog open={pendingEdit !== null} entry={pendingEdit} onOpenChange={(open) => !open && setPendingEdit(null)} />
    </Card>
  );
}
