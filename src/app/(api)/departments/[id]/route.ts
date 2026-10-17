import { authenticate } from "@/lib/api/access";
import { deleteDepartment, getDepartment, updateDepartment } from "@/lib/api/features/departments";
import { parseName } from "@/lib/api/features/organizations";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getDepartment(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateDepartment(access, id, parseName(await readBody(request)));
});

export const DELETE = withGuids<{ id: string }>(async (request, { id }) => {
  await deleteDepartment(await authenticate(request), id);
}, 204);
