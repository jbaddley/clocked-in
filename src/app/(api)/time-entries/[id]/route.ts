import { authenticate } from "@/lib/api/access";
import { deleteTimeEntry, getTimeEntry, parseUpdateTimeEntry, updateTimeEntry } from "@/lib/api/features/time-entries";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getTimeEntry(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateTimeEntry(access, id, parseUpdateTimeEntry(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteTimeEntry(await authenticate(request), id);
}, 204);
