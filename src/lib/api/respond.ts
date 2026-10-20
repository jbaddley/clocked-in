import { connection } from "next/server";
import { ApiError, explain } from "@/lib/api/errors";
import { json, noContent } from "@/lib/api/json";

export async function respond(work: () => Promise<unknown>, status = 200) {
  await connection();
  try {
    const result = await work();
    if (result instanceof Response) {
      return result;
    }

    if (result === undefined || status === 204) {
      return noContent();
    }

    return json(result, status);
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ code: error.code, message: error.message }, error.status);
    }

    console.error(error);
    return json({ code: "server_error", message: explain(error) }, 500);
  }
}
