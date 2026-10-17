import { authenticate } from "@/lib/api/access";
import { revokeOrganizationInvitation } from "@/lib/api/features/invitations";
import { withGuids } from "@/lib/api/guid";

export const DELETE = withGuids<{ id: string; invitationId: string }>(async (request, { id, invitationId }) =>
  revokeOrganizationInvitation(await authenticate(request), id, invitationId),
);
