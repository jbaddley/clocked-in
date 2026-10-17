import { authenticate } from "@/lib/api/access";
import { createOrganization, listOrganizations, parseName } from "@/lib/api/features/organizations";
import { query, readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(async () => listOrganizations(await authenticate(request), query(request)));
}

export function POST(request: Request) {
  return respond(async () => {
    const access = await authenticate(request);
    return createOrganization(access, parseName(await readBody(request)));
  }, 201);
}

