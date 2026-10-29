import { ApiError, validation } from "@/lib/api/errors";
import { type Body } from "@/lib/api/json";

export function jsonBody(value: string, name = "body"): Body {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Body;
    }
  } catch {}

  validation(`${name} must be a JSON object.`);
}

export function query(values: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }

  return params;
}

export async function mcpCall<T>(work: () => Promise<T>) {
  try {
    const value = await work();
    return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }] };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `${error.code}: ${error.message}` }],
      };
    }

    throw error;
  }
}
