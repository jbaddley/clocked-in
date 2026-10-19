import { authenticate } from "@/lib/api/access";
import { getUser, parseUpdateUser, updateUser } from "@/lib/api/features/users";
import { readBody } from "@/lib/api/json";
import { respond } from "@/lib/api/respond";

export function GET(request: Request) {
  return respond(async () => {
    const access = await authenticate(request, { allowPasswordChange: true });
    return getUser(access, access.caller.id);
  });
}

export function PATCH(request: Request) {
  return respond(async () => {
    const access = await authenticate(request, { allowPasswordChange: true });
    return updateUser(access, access.caller.id, parseUpdateUser(await readBody(request)), true);
  });
}
