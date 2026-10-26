import { authenticate } from "@/lib/api/access";
import { deleteSignup } from "@/lib/api/features/volunteer-needs";
import { withGuids } from "@/lib/api/guid";

export const DELETE = withGuids<{ id: string; signupId: string }>(async (request, { id, signupId }) => {
  await deleteSignup(await authenticate(request), id, signupId);
}, 204);
