import { authenticate } from "@/lib/api/access";
import {
  deleteOrganization,
  getOrganization,
  parseUpdateOrganization,
  updateOrganization,
} from "@/lib/api/features/organizations";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getOrganization(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateOrganization(access, id, parseUpdateOrganization(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteOrganization(await authenticate(request), id);
}, 204);
