import { authenticate } from "@/lib/api/access";
import { listDepartmentMemberships } from "@/lib/api/features/memberships";
import { withGuids } from "@/lib/api/guid";
import { query } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) =>
  listDepartmentMemberships(await authenticate(request), id, query(request)),
);
