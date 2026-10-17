import { authenticate } from "@/lib/api/access";
import { acceptInvitation, parseAcceptInvitation } from "@/lib/api/features/invitations";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function POST(request: Request) {
  return respond(async () => {
    const access = await authenticate(request);
    return acceptInvitation(access, parseAcceptInvitation(await readBody(request)));
  });
}
