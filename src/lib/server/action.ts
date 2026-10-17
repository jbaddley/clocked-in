import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import type { ActionResult } from "@/lib/types";

export async function run<T>(work: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await work();
    return { ok: true, data, message };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError) {
      return { ok: false, error: error.message };
    }

    console.error(error);
    return { ok: false, error: "Something went wrong." };
  }
}

export function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// The API parsers treat a present key as "set", so drop keys whose value is undefined.
export function body(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function safeNext(value: string, fallback = "/dashboard") {
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
