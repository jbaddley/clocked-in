import { authenticate } from "@/lib/api/access";
import { createTimeEntry, listTimeEntries, parseCreateTimeEntry } from "@/lib/api/features/time-entries";
import { withGuids } from "@/lib/api/guid";
import { query, readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listTimeEntries(await authenticate(request), id, query(request)),
);

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return createTimeEntry(access, id, parseCreateTimeEntry(await readBody(request)));
}, 201);
