import { authenticate } from "@/lib/api/access";
import { deleteVolunteerNeed, getVolunteerNeed, parseUpdateNeed, updateVolunteerNeed } from "@/lib/api/features/volunteer-needs";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  getVolunteerNeed(await authenticate(request), id),
);

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateVolunteerNeed(access, id, parseUpdateNeed(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteVolunteerNeed(await authenticate(request), id);
}, 204);
