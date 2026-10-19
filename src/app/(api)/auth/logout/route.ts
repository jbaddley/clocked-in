import { authenticate } from "@/lib/api/access";
import { logOut, parseRefreshToken } from "@/lib/api/features/auth";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function POST(request: Request) {
  return respond(async () => {
    const access = await authenticate(request, { allowPasswordChange: true });
    return logOut(access, parseRefreshToken(await readBody(request)));
  });
}
