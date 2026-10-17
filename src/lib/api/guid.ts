import { respond } from "@/lib/api/respond";

const hyphenated = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const compact = /^[0-9a-f]{32}$/i;
const guidX =
  /^\{0x([0-9a-f]{1,8}),0x([0-9a-f]{1,4}),0x([0-9a-f]{1,4}),\{0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2}),0x([0-9a-f]{1,2})\}\}$/i;

export function emptyNotFound() {
  return new Response(null, { status: 404 });
}

function hyphenate(value: string) {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function parseGuidX(value: string) {
  const match = guidX.exec(value.replace(/\s+/g, ""));
  if (!match) {
    return null;
  }

  const hex = (part: string, width: number) => part.padStart(width, "0").toLowerCase();
  const rest = match.slice(4).map((part) => hex(part, 2)).join("");
  return `${hex(match[1], 8)}-${hex(match[2], 4)}-${hex(match[3], 4)}-${rest.slice(0, 4)}-${rest.slice(4)}`;
}

export function parseGuid(value: string) {
  const text = value.trim();
  const extended = parseGuidX(text);
  if (extended) {
    return extended;
  }

  let body = text;
  if (text.startsWith("{") && text.endsWith("}")) {
    body = text.slice(1, -1).trim();
  } else if (text.startsWith("(") && text.endsWith(")")) {
    body = text.slice(1, -1).trim();
  } else if (/^[{(]|[)}]$/.test(text)) {
    return null;
  }

  if (hyphenated.test(body)) {
    return body.toLowerCase();
  }

  if (compact.test(body)) {
    return hyphenate(body.toLowerCase());
  }

  return null;
}

export function requireGuids<T extends Record<string, string>>(params: T) {
  const normalized = {} as T;
  for (const key of Object.keys(params) as (keyof T)[]) {
    const id = parseGuid(params[key]);
    if (!id) {
      return emptyNotFound();
    }

    normalized[key] = id as T[keyof T];
  }

  return normalized;
}

export function withGuids<T extends Record<string, string>>(
  handle: (request: Request, params: T) => Promise<unknown>,
  status = 200,
) {
  return (request: Request, context: { params: Promise<T> }) =>
    respond(async () => {
      const params = requireGuids(await context.params);
      if (params instanceof Response) {
        return params;
      }

      return handle(request, params);
    }, status);
}
