import { authenticate } from "@/lib/api/access";
import { previewUsername } from "@/lib/api/features/invitations";
import { withGuids } from "@/lib/api/guid";
import { query } from "@/lib/api/json";

export const GET = withGuids(async (request) => {
  await authenticate(request);
  const params = query(request);
  return previewUsername(params.get("firstName") ?? "", params.get("lastName") ?? "");
});
