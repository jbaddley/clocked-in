import { publicVolunteerNeed } from "@/lib/api/features/volunteer-needs";
import { respond } from "@/lib/api/respond";

export function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  return respond(async () => publicVolunteerNeed((await context.params).token));
}
