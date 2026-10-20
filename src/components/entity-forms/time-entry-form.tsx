"use client";

import { useId, useMemo, useState } from "react";
import {
  createEntriesAction,
  createEntryAction,
  updateEntryAction,
  type EntryPatch,
  type NewEntry,
} from "@/app/actions/entries";
import { HourlyRateSelect, defaultVolunteerRateId } from "@/components/hourly-rate-select";
import { useLookups } from "@/hooks/use-lookups";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { Field } from "@/components/field";
import { PersonSelect, selectableMembers } from "@/components/person-select";
import { alignedEntryGridClass, PlacementFields } from "@/components/placement-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useMembers } from "@/hooks/use-members";
import { organizationWide, usePlacement, type PlacementPreference } from "@/hooks/use-placement";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { today } from "@/lib/format";
import { keys } from "@/lib/queries";
import type { TimeEntry } from "@/lib/types";

function localTime(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function hoursFromMinutes(minutes: number | null) {
  if (!minutes) return "";
  return String(Math.round((minutes / 60) * 100) / 100);
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TimeEntryForm({
  entry,
  preferred,
  onCancel,
  onSaved,
  submitLabel,
  userId: lockedUserId,
  userIds,
  people,
}: {
  entry?: TimeEntry;
  preferred?: PlacementPreference;
  onCancel?: () => void;
  onSaved?: () => void;
  submitLabel?: string;
  userId?: string;
  userIds?: string[];
  people?: { excludeSelf?: boolean; activeOnly?: boolean };
}) {
  const organization = useOrganization();
  const { viewer, isAdmin, canSelectRate } = useWorkspace();
  const { lookups } = useLookups();
  const idPrefix = useId();
  const excludeSelf = people?.excludeSelf ?? false;
  const activeOnly = people?.activeOnly ?? false;
  const batch = Boolean(userIds && userIds.length > 0);
  const { members } = useMembers({ enabled: isAdmin && !entry && !lockedUserId && !batch });
  const eligible = useMemo(
    () => selectableMembers(members, viewer.id, { excludeSelf, activeOnly }),
    [activeOnly, excludeSelf, members, viewer.id],
  );
  const punch = entry?.mode === "Punch";
  const total = entry?.mode === "Total";
  const canEditTimes = !entry || organization.preferences.allowTimeEntryEditing;
  const placement = usePlacement(
    entry
      ? {
          departmentId: entry.departmentId ?? organizationWide,
          projectId: entry.projectId,
          taskCategoryId: entry.taskCategoryId,
          tagIds: entry.tagIds,
        }
      : preferred,
  );
  const [personId, setPersonId] = useState(lockedUserId ?? entry?.userId ?? (excludeSelf || activeOnly ? "" : viewer.id));
  const selectedPersonId =
    excludeSelf || activeOnly
      ? eligible.some((member) => member.userId === personId)
        ? personId
        : (eligible[0]?.userId ?? "")
      : personId;
  const [hourlyRateId, setHourlyRateId] = useState(
    entry?.hourlyRateId ?? defaultVolunteerRateId(lookups.hourlyRates),
  );
  const [occurredOn, setOccurredOn] = useState(entry?.occurredOn ?? today());
  const [hours, setHours] = useState(entry ? hoursFromMinutes(entry.durationMinutes) : "1");
  const [start, setStart] = useState(localTime(entry?.startedAt ?? null, entry ? "" : "09:00"));
  const [end, setEnd] = useState(localTime(entry?.endedAt ?? null, entry ? "" : "10:00"));
  const [driver, setDriver] = useState<"end" | "duration">(entry?.endedAt || !entry ? "end" : "duration");
  const [notes, setNotes] = useState(entry?.description ?? "");
  const [error, setError] = useState("");

  const create = useActionMutation(
    async ({ userId, next }: { userId: string; next: NewEntry }) => {
      if (batch) return createEntriesAction(userIds!, next);
      const result = await createEntryAction(userId, next);
      return result.ok ? { ok: true as const, message: result.message } : result;
    },
    {
      invalidate: [keys.organization(organization.id)],
      onSuccess: () => {
        setNotes("");
        setError("");
        onSaved?.();
      },
    },
  );
  const update = useActionMutation(({ id, patch }: { id: string; patch: EntryPatch }) => updateEntryAction(id, patch), {
    invalidate: entry?.mode === "Punch" ? [keys.organization(organization.id), keys.openPunch(entry.userId)] : [keys.organization(organization.id)],
    onSuccess: () => {
      setError("");
      onSaved?.();
    },
  });

  function applyStart(value: string, nextDate = occurredOn, nextDriver = driver, nextHours = hours, nextEnd = end) {
    setStart(value);
    if (!value) return;
    if (nextDriver === "duration" && nextHours.trim()) {
      const minutes = Math.round(Number(nextHours) * 60);
      const startedAt = new Date(`${nextDate}T${value}`);
      if (Number.isFinite(minutes) && minutes >= 1 && !Number.isNaN(startedAt.getTime())) {
        setEnd(localTime(new Date(startedAt.getTime() + minutes * 60000).toISOString(), ""));
      }
      return;
    }

    if (nextEnd) {
      const minutes = Math.floor((new Date(`${nextDate}T${nextEnd}`).getTime() - new Date(`${nextDate}T${value}`).getTime()) / 60000);
      setHours(minutes >= 1 ? hoursFromMinutes(minutes) : "");
    }
  }

  function span(): { occurredOn: string; durationMinutes: number; startedAt: string; endedAt: string } | null {
    if (!start) {
      setError("Start time is required.");
      return null;
    }

    const startedAt = new Date(`${occurredOn}T${start}`);
    if (Number.isNaN(startedAt.getTime())) {
      setError("Start time is required.");
      return null;
    }

    if (driver === "duration" && hours.trim()) {
      const minutes = Math.round(Number(hours) * 60);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
        setError("Duration must be from 1 minute to 24 hours.");
        return null;
      }

      setError("");
      return {
        occurredOn,
        durationMinutes: minutes,
        startedAt: startedAt.toISOString(),
        endedAt: new Date(startedAt.getTime() + minutes * 60000).toISOString(),
      };
    }

    if (end) {
      const endedAt = new Date(`${occurredOn}T${end}`);
      const minutes = Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000);
      if (minutes < 1 || minutes > 1440) {
        setError(minutes > 1440 ? "Duration must be 24 hours or less." : "End time must be after start time.");
        return null;
      }

      setError("");
      return {
        occurredOn,
        durationMinutes: minutes,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      };
    }

    setError("Add an end time or a duration.");
    return null;
  }

  function timePatch(): EntryPatch | null {
    if (!canEditTimes) return {};
    if (total) {
      const minutes = Math.round(Number(hours) * 60);
      if (!Number.isFinite(minutes) || minutes < 1) {
        setError("Duration must be at least 1 minute.");
        return null;
      }

      setError("");
      return { occurredOn, durationMinutes: minutes };
    }

    if (punch && !end && !hours.trim()) {
      if (!start) {
        setError("Start time is required.");
        return null;
      }

      const startedAt = new Date(`${occurredOn}T${start}`);
      if (Number.isNaN(startedAt.getTime())) {
        setError("Start time is required.");
        return null;
      }

      setError("");
      return { startedAt: startedAt.toISOString() };
    }

    if (!start && entry?.mode === "Duration" && !entry.startedAt) {
      const minutes = Math.round(Number(hours) * 60);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
        setError("Duration must be from 1 minute to 24 hours.");
        return null;
      }

      setError("");
      return { occurredOn, durationMinutes: minutes };
    }

    return span();
  }

  const showPerson = !(entry || !isAdmin || lockedUserId || batch);
  const showRate = canSelectRate || lookups.hourlyRates.some((rate) => rate.isDefault);
  const endsNextDay =
    driver === "duration" &&
    Boolean(start) &&
    Boolean(hours.trim()) &&
    (() => {
      const minutes = Math.round(Number(hours) * 60);
      const startedAt = new Date(`${occurredOn}T${start}`);
      if (!Number.isFinite(minutes) || minutes < 1 || Number.isNaN(startedAt.getTime())) return false;
      return localDateValue(new Date(startedAt.getTime() + minutes * 60000)) !== occurredOn;
    })();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!entry && (!placement.ready || (showPerson && !selectedPersonId))) return;
        const base = placement.placement(notes);
        if (entry) {
          const times = timePatch();
          if (!times) return;
          update.mutate({
            id: entry.id,
            patch: {
              departmentId: base.departmentId,
              projectId: base.projectId,
              taskCategoryId: base.taskCategoryId,
              description: base.description,
              tagIds: base.tagIds,
              hourlyRateId: canSelectRate ? hourlyRateId || null : undefined,
              ...times,
            },
          });
          return;
        }

        const times = span();
        if (!times) return;
        create.mutate({
          userId: selectedPersonId,
          next: { ...base, mode: "Duration", hourlyRateId: canSelectRate ? hourlyRateId || null : null, ...times },
        });
      }}
    >
      {showPerson || showRate ? (
        <div className={showPerson && showRate ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
          {showPerson ? (
            <Field label="Person">
              <PersonSelect
                value={selectedPersonId}
                onValueChange={setPersonId}
                className="h-10"
                excludeSelf={excludeSelf}
                activeOnly={activeOnly}
                placeholder={excludeSelf ? "Select a member" : undefined}
              />
            </Field>
          ) : null}
          {showRate ? (
            <HourlyRateSelect value={hourlyRateId} onValueChange={setHourlyRateId} locked={!canSelectRate} />
          ) : null}
        </div>
      ) : null}
      <div className={alignedEntryGridClass}>
        {punch && !canEditTimes ? (
          <p className="col-span-full text-sm text-muted-foreground">
            Timer times cannot be changed here. Update the project, category, and notes, or stop the timer.
          </p>
        ) : total ? (
          <>
            <Field label="Date" htmlFor={`${idPrefix}-occurredOn`}>
              <Input
                id={`${idPrefix}-occurredOn`}
                type="date"
                value={occurredOn}
                max={today()}
                onChange={(event) => setOccurredOn(event.target.value)}
                required
                disabled={!canEditTimes}
                className="h-10"
              />
            </Field>
            <Field label="Duration" htmlFor={`${idPrefix}-hours`} error={error || null} className="sm:col-start-4">
              <Input
                id={`${idPrefix}-hours`}
                type="number"
                inputMode="decimal"
                min="0.25"
                step="0.25"
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                required
                disabled={!canEditTimes}
                className="h-10 px-2 text-center"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Date" htmlFor={`${idPrefix}-occurredOn`}>
              <Input
                id={`${idPrefix}-occurredOn`}
                type="date"
                value={occurredOn}
                max={today()}
                onChange={(event) => {
                  const value = event.target.value;
                  setOccurredOn(value);
                  applyStart(start, value);
                }}
                required
                disabled={!canEditTimes}
                className="h-10"
              />
            </Field>
            <Field label="Start" htmlFor={`${idPrefix}-start`}>
              <Input
                id={`${idPrefix}-start`}
                type="time"
                value={start}
                onChange={(event) => applyStart(event.target.value)}
                required={!entry || Boolean(entry.startedAt) || punch}
                disabled={!canEditTimes}
                className="h-10"
              />
            </Field>
            <Field label="End" htmlFor={`${idPrefix}-end`} error={error || null}>
              <Input
                id={`${idPrefix}-end`}
                type="time"
                value={end}
                onChange={(event) => {
                  const value = event.target.value;
                  setEnd(value);
                  setDriver("end");
                  if (!start || !value) {
                    if (!value) setHours("");
                    return;
                  }

                  const minutes = Math.floor(
                    (new Date(`${occurredOn}T${value}`).getTime() - new Date(`${occurredOn}T${start}`).getTime()) / 60000,
                  );
                  setHours(minutes >= 1 ? hoursFromMinutes(minutes) : "");
                }}
                disabled={!canEditTimes}
                className="h-10"
              />
            </Field>
            <Field label="Duration" htmlFor={`${idPrefix}-hours`}>
              <Input
                id={`${idPrefix}-hours`}
                type="number"
                inputMode="decimal"
                min="0.25"
                step="0.25"
                value={hours}
                onChange={(event) => {
                  const value = event.target.value;
                  setHours(value);
                  setDriver("duration");
                  const minutes = Math.round(Number(value) * 60);
                  if (!start || !Number.isFinite(minutes) || minutes < 1) {
                    if (!value.trim()) setEnd("");
                    return;
                  }

                  const startedAt = new Date(`${occurredOn}T${start}`);
                  if (Number.isNaN(startedAt.getTime())) return;
                  setEnd(localTime(new Date(startedAt.getTime() + minutes * 60000).toISOString(), ""));
                }}
                disabled={!canEditTimes}
                className="h-10 px-2 text-center"
              />
            </Field>
          </>
        )}
        {endsNextDay ? <p className="col-span-full text-sm text-muted-foreground">Ends the next day.</p> : null}
        {!canEditTimes && !punch ? (
          <p className="col-span-full text-sm text-muted-foreground">Times stay as saved until an admin allows time entry editing.</p>
        ) : null}
        <PlacementFields state={placement} embedded />
      </div>
      <Field label="Notes" htmlFor={`${idPrefix}-notes`}>
        <Textarea
          id={`${idPrefix}-notes`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="What did you work on?"
          rows={2}
        />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <SubmitButton
          pending={entry ? update.isPending : create.isPending}
          disabled={(!entry && !placement.ready) || (showPerson && !selectedPersonId)}
          className="h-9 w-full sm:w-auto"
        >
          {submitLabel ?? (entry ? "Save" : "Save time")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function TimeEntryDialog({
  open,
  onOpenChange,
  entry,
  userId,
  userIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: TimeEntry | null;
  userId?: string;
  userIds?: string[];
}) {
  const organization = useOrganization();
  const canEditTimes = organization.preferences.allowTimeEntryEditing;
  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? "Edit time entry" : userIds && userIds.length > 1 ? "Add time for selected people" : "Add time"}
      description={
        entry
          ? canEditTimes
            ? "Change the start, then the end or the duration."
            : "You can update the project, category, and notes."
          : userIds && userIds.length > 1
            ? `This saves the same entry for ${userIds.length} people.`
            : "Add a start time, then an end time or a duration."
      }
      className="sm:max-w-xl"
    >
      <TimeEntryForm
        entry={entry ?? undefined}
        userId={userId}
        userIds={userIds}
        onCancel={() => onOpenChange(false)}
        onSaved={() => onOpenChange(false)}
      />
    </EntityFormDialog>
  );
}
