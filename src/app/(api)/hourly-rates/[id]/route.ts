import { authenticate } from "@/lib/api/access";
import { deleteHourlyRate, parseUpdateHourlyRate, updateHourlyRate } from "@/lib/api/features/hourly-rates";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateHourlyRate(access, id, parseUpdateHourlyRate(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteHourlyRate(await authenticate(request), id);
}, 204);
