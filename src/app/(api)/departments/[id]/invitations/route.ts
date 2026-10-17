import { authenticate } from "@/lib/api/access";
import {
  createDepartmentInvitation,
  listDepartmentInvitations,
  parseCreateInvitation,
} from "@/lib/api/features/invitations";
import { withGuids } from "@/lib/api/guid";
import { query, readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listDepartmentInvitations(await authenticate(request), id, query(request)),
);

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return createDepartmentInvitation(access, id, parseCreateInvitation(await readBody(request)));
}, 201);
