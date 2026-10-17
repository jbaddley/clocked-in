import { authenticate } from "@/lib/api/access";
import { listUsers } from "@/lib/api/features/users";
import { query } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(async () => listUsers(await authenticate(request), query(request)));
}
