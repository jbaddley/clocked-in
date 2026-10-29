import { authenticate } from "@/lib/api/access";
import { previewUsername } from "@/lib/api/features/invitations";
import { respond } from "@/lib/api/respond";
import { query } from "@/lib/api/json";

export function GET(request: Request) {
  return respond(async () => {
    await authenticate(request);
    const params = query(request);
    return previewUsername(params.get("firstName") ?? "", params.get("lastName") ?? "");
  });
}
