import { authenticate } from "@/lib/api/access";
import { createFeedback, listFeedback, parseCreateFeedback } from "@/lib/api/features/feedback";
import { query, readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(async () => listFeedback(await authenticate(request), query(request)));
}

export function POST(request: Request) {
  return respond(async () => {
    const access = await authenticate(request);
    return createFeedback(access, parseCreateFeedback(await readBody(request)));
  }, 201);
}
