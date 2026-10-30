import { handleLinearWebhook } from "@/lib/api/features/feedback";
import { respond } from "@/lib/api/respond";

export function POST(request: Request) {
  return respond(async () => {
    const rawBody = await request.text();
    const signature = request.headers.get("linear-signature");
    return handleLinearWebhook(rawBody, signature);
  });
}
