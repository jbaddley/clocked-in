import { authenticate } from "@/lib/api/access";
import { vetSignup } from "@/lib/api/features/volunteer-needs";
import { withGuids } from "@/lib/api/guid";

export const POST = withGuids<{ id: string; signupId: string }>(async (request, { id, signupId }) =>
  vetSignup(await authenticate(request), id, signupId),
);
