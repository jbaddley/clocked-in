export function safeHttpUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function websiteHref(value: string) {
  const trimmed = value.trim();
  return safeHttpUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
}
