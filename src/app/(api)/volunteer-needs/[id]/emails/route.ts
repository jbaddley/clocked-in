import { authenticate } from "@/lib/api/access";
import { emailVolunteers, parseVolunteerEmail } from "@/lib/api/features/volunteer-needs";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const POST = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return emailVolunteers(access, id, parseVolunteerEmail(await readBody(request)));
});
