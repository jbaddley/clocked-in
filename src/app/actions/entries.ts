"use server";

import {
  clockIn,
  clockOut,
  createTimeEntry,
  deleteTimeEntry,
  parseClockIn,
  parseClockOut,
  parseCreateTimeEntry,
  parseUpdateTimeEntry,
  updateTimeEntry,
} from "@/lib/api/features/time-entries";
import { body, run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export type Placement = {
  organizationId: string;
  departmentId: string | null;
  projectId: string;
  taskCategoryId: string;
  description: string | null;
  tagIds: string[];
};

export type NewEntry = Placement & {
  mode: "Duration" | "Total";
  occurredOn: string;
  durationMinutes: number;
  startedAt?: string;
  endedAt?: string;
  hourlyRateId?: string | null;
};

export async function createEntryAction(userId: string, entry: NewEntry) {
  return run(async () => {
    const access = await requireAccess();
    return createTimeEntry(access, userId, parseCreateTimeEntry(body(entry)));
  }, "Time saved.");
}

export async function createEntriesAction(userIds: string[], entry: NewEntry) {
  return run(async () => {
    const access = await requireAccess();
    const parsed = parseCreateTimeEntry(body(entry));
    for (const userId of userIds) {
      await createTimeEntry(access, userId, parsed);
    }
  }, userIds.length === 1 ? "Time saved." : `Time saved for ${userIds.length} people.`);
}

export type EntryPatch = {
  departmentId?: string | null;
  projectId?: string;
  taskCategoryId?: string;
  description?: string | null;
  tagIds?: string[];
  occurredOn?: string;
  durationMinutes?: number;
  startedAt?: string | null;
  endedAt?: string | null;
  hourlyRateId?: string | null;
};

export async function updateEntryAction(entryId: string, patch: EntryPatch) {
  return run(async () => {
    const access = await requireAccess();
    return updateTimeEntry(access, entryId, parseUpdateTimeEntry(body(patch)));
  }, "Entry saved.");
}

export async function deleteEntryAction(entryId: string) {
  return run(async () => {
    const access = await requireAccess();
    await deleteTimeEntry(access, entryId);
  }, "Entry deleted.");
}

export async function clockInAction(placement: Placement) {
  return run(async () => {
    const access = await requireAccess();
    return clockIn(access, parseClockIn(body(placement)));
  }, "Timer started.");
}

export async function clockOutAction(details: { description?: string | null; tagIds?: string[] } = {}) {
  return run(async () => {
    const access = await requireAccess();
    return clockOut(access, parseClockOut(body(details)));
  }, "Timer stopped.");
}
