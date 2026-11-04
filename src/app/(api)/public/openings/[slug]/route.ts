import { listPublicNeeds } from "@/lib/api/features/volunteer-needs";
import { respond } from "@/lib/api/respond";
import { resolveRequestTenantSlug } from "@/lib/portal";

export function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  return respond(async () =>
    listPublicNeeds((await context.params).slug, { tenantSlug: resolveRequestTenantSlug(request.headers) }),
  );
}
