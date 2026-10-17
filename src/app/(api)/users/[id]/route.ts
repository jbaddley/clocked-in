import { authenticate } from "@/lib/api/access";
import { deleteUser, getUser, parseUpdateUser, updateUser } from "@/lib/api/features/users";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getUser(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateUser(access, id, parseUpdateUser(await readBody(request)), false);
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteUser(await authenticate(request), id);
}, 204);
