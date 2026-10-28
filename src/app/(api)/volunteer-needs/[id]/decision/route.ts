import { authenticate } from "@/lib/api/access";
import { decideNeed } from "@/lib/api/features/volunteer-needs";
import { withGuids } from "@/lib/api/guid";
import { readBody, requireString } from "@/lib/api/json";
import { validation } from "@/lib/api/errors";

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  const status = requireString(await readBody(request), "status");
  if (status !== "published" && status !== "rejected") {
    validation("status must be published or rejected.");
  }
  return decideNeed(access, id, status);
});
