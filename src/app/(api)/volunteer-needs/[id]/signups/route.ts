import { authenticate } from "@/lib/api/access";
import { listSignups } from "@/lib/api/features/volunteer-needs";
import { withGuids } from "@/lib/api/guid";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listSignups(await authenticate(request), id),
);
