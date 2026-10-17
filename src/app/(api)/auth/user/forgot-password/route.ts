import { confirmPasswordReset, parseConfirmPasswordReset, requestPasswordReset } from "@/lib/api/features/auth";
import { query, readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(() => requestPasswordReset(query(request).get("email")));
}

export function POST(request: Request) {
  return respond(async () => confirmPasswordReset(parseConfirmPasswordReset(await readBody(request))));
}
