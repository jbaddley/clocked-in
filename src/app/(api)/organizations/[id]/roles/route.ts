import { authenticate } from "@/lib/api/access";
import { createOrganizationRole, listOrganizationRoles, parseCreateRole } from "@/lib/api/features/roles";
import { withGuids } from "@/lib/api/guid";
import { query, readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listOrganizationRoles(await authenticate(request), id, query(request)),
);

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return createOrganizationRole(access, id, parseCreateRole(await readBody(request)));
}, 201);
