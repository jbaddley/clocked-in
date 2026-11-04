import { publicVolunteerNeed } from "@/lib/api/features/volunteer-needs";
import { respond } from "@/lib/api/respond";
import { resolveRequestTenantSlug } from "@/lib/portal";

export function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return respond(async () =>
    publicVolunteerNeed((await context.params).token, { tenantSlug: resolveRequestTenantSlug(request.headers) }),
  );
}
