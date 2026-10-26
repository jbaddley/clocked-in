import { authenticate } from "@/lib/api/access";
import { parsePublicSignup, signUpForNeed } from "@/lib/api/features/volunteer-needs";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

async function optionalAccess(request: Request) {
  if (!request.headers.get("authorization")?.trim()) return null;
  return authenticate(request);
}

export function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  return respond(async () => {
    const { token } = await context.params;
    return signUpForNeed(await optionalAccess(request), token, parsePublicSignup(await readBody(request)));
  }, 201);
}
