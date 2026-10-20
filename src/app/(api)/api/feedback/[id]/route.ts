import { authenticate } from "@/lib/api/access";
import { getFeedback, parseUpdateFeedback, updateFeedback } from "@/lib/api/features/feedback";
import { withGuids } from "@/lib/api/guid";
import { readBody } from "@/lib/api/json";

export const GET = withGuids<{ id: string }>(async (request, { id }) => getFeedback(await authenticate(request), id));

export const PATCH = withGuids<{ id: string }>(async (request, { id }) => {
  const access = await authenticate(request);
  return updateFeedback(access, id, parseUpdateFeedback(await readBody(request)));
});
