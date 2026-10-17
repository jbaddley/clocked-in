import { authenticate } from "@/lib/api/access";
import { createDepartment, listDepartments } from "@/lib/api/features/departments";
import { parseName } from "@/lib/api/features/organizations";
import { withGuids } from "@/lib/api/guid";
import { query, readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listDepartments(await authenticate(request), id, query(request)),
);

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return createDepartment(access, id, parseName(await readBody(request)));
}, 201);
