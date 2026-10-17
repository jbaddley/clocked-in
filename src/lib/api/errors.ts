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

export function notFound(): never {
  fail(404, "not_found", "Not found.");
}

export function conflict(message: string): never {
  fail(409, "conflict", message);
}
