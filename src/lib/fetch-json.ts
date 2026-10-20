export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    signal,
    headers: { accept: "application/json" },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.status === 401 && typeof window !== "undefined") {
    // The helper runs outside React, so a full navigation is the only way off an expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }

  if (!response.ok) {
    throw new HttpError(response.status, body?.message ?? "Request failed.");
  }

  return body as T;
}
