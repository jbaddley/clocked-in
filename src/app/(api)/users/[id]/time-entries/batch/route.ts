import { authenticate } from "@/lib/api/access";
import { createTimeEntries, parseCreateTimeEntries } from "@/lib/api/features/time-entries";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return createTimeEntries(access, id, parseCreateTimeEntries(await readBody(request)));
}, 201);
