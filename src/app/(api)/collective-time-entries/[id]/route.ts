import { authenticate } from "@/lib/api/access";
import { deleteCollective, getCollective, parseUpdateCollective, updateCollective } from "@/lib/api/features/collective";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getCollective(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateCollective(access, id, parseUpdateCollective(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteCollective(await authenticate(request), id);
}, 204);
