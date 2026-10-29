import { confirmPasswordReset, parseConfirmPasswordReset, requestPasswordReset } from "@/lib/api/features/auth";
import { query, readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";
import { tenantHeader } from "@/lib/portal";

export function GET(request: Request) {
  return respond(() =>
    requestPasswordReset(query(request).get("email"), {
      tenantSlug: request.headers.get(tenantHeader),
    }),
  );
}

export function POST(request: Request) {
  return respond(async () => confirmPasswordReset(parseConfirmPasswordReset(await readBody(request))));
}
