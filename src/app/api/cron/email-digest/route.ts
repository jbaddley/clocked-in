import { connection } from "next/server";
import { sendWeeklyDigests } from "@/lib/email/digest";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await sendWeeklyDigests();
  if (!result.emailConfigured) {
    return Response.json(result, { status: 503 });
  }

  return Response.json(result);
}
