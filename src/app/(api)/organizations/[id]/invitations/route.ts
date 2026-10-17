import { authenticate } from "@/lib/api/access";
import {
  createOrganizationInvitation,
  listOrganizationInvitations,
  parseCreateInvitation,
} from "@/lib/api/features/invitations";
import { withGuids } from "@/lib/api/guid";
import { query, readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listOrganizationInvitations(await authenticate(request), id, query(request)),
);

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return createOrganizationInvitation(access, id, parseCreateInvitation(await readBody(request)));
}, 201);
