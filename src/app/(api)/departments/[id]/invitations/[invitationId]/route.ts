import { authenticate } from "@/lib/api/access";
import { revokeDepartmentInvitation } from "@/lib/api/features/invitations";
import { withGuids } from "@/lib/api/guid";

export const DELETE = withGuids<{ id: string; invitationId: string }>(async (request, { id, invitationId }) =>
  revokeDepartmentInvitation(await authenticate(request), id, invitationId),
);
