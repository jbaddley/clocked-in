import { parseRefreshToken, refresh } from "@/lib/api/features/auth";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function POST(request: Request) {
  return respond(async () => refresh(parseRefreshToken(await readBody(request))));
}
