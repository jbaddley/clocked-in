import { authenticate } from "@/lib/api/access";
import { listRoles } from "@/lib/api/features/memberships";
import { query } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(async () => {
    await authenticate(request);
    return listRoles(query(request));
  });
}
