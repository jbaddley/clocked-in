import { authenticate } from "@/lib/api/access";
import { createTimeEntry, parseLogDuration } from "@/lib/api/features/time-entries";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function POST(request: Request) {
  return respond(async () => {
    const access = await authenticate(request);
    return createTimeEntry(access, access.caller.id, parseLogDuration(await readBody(request)));
  }, 201);
}
