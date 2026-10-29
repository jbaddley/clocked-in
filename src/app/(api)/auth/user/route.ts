import { parseSignUp, signUp } from "@/lib/api/features/auth";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";
import { tenantHeader } from "@/lib/portal";

export function POST(request: Request) {
  return respond(
    async () =>
      signUp(parseSignUp(await readBody(request)), {
        tenantSlug: request.headers.get(tenantHeader),
      }),
    201,
  );
}
