import { authenticate } from "@/lib/api/access";
import { createCollective, listCollective, parseCreateCollective } from "@/lib/api/features/collective";
import { query, readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(async () => listCollective(await authenticate(request), query(request)));
}

export function POST(request: Request) {
  return respond(async () => {
    const access = await authenticate(request);
    return createCollective(access, parseCreateCollective(await readBody(request)));
  }, 201);
}
