import { authenticate } from "@/lib/api/access";
import { editFeedback, getFeedback, parseEditFeedback, parseUpdateFeedback, updateFeedback } from "@/lib/api/features/feedback";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getFeedback(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  const body = await readBody(request);
  if (typeof body.status === "string") {
    return updateFeedback(access, id, parseUpdateFeedback(body));
  }

  return editFeedback(access, id, parseEditFeedback(body));
});
