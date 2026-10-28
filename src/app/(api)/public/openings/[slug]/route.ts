import { listPublicNeeds } from "@/lib/api/features/volunteer-needs";
import { respond } from "@/lib/api/respond";

export function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  return respond(async () => listPublicNeeds((await context.params).slug));
}
