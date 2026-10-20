export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function fail(status: number, code: string, message: string): never {
  throw new ApiError(status, code, message);
}

export function validation(message: string): never {
  fail(400, "validation_error", message);
}

export function unauthorized(message = "Authentication is required."): never {
  fail(401, "unauthorized", message);
}

export function forbidden(): never {
  fail(403, "forbidden", "Forbidden.");
}

export function passwordChangeRequired(): never {
  fail(403, "password_change_required", "You must change your password before continuing.");
}

export function notFound(): never {
  fail(404, "not_found", "Not found.");
}

export function conflict(message: string): never {
  fail(409, "conflict", message);
}

const secret = /postgres(?:ql)?:\/\//i;

function nestedApiError(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof ApiError) {
      return current;
    }

    const node = current as { cause?: unknown };
    current = node.cause;
  }

  return null;
}

function readableLine(message: string) {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        line.length <= 240 &&
        !line.startsWith("at ") &&
        !line.startsWith("?") &&
        !line.startsWith("{") &&
        !line.startsWith("}") &&
        !line.startsWith("Invalid `") &&
        !line.startsWith("Available options") &&
        !secret.test(line),
    );
  const sentence = [...lines].reverse().find((line) => /[a-z]/i.test(line));
  if (!sentence) {
    return null;
  }

  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

export function explain(error: unknown) {
  const api = nestedApiError(error);
  if (api) {
    return api.message;
  }

  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code === "P2025") {
    return "A required record was not found.";
  }

  if (code === "P2028") {
    return "That took too long and was cancelled. Try again.";
  }

  if (code === "P2021" || code === "P2022") {
    return "The database is missing a table or column this action needs.";
  }

  if (error instanceof Error) {
    return readableLine(error.message) ?? "Something went wrong.";
  }

  return "Something went wrong.";
}
