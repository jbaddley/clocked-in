import { isVercelBlobUrl } from "@/lib/brand";
import { safeHttpUrl } from "@/lib/url";

export function avatarImageSrc(userId: string, storedUrl: string | null | undefined) {
  const trimmed = storedUrl?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  if (isVercelBlobUrl(trimmed)) {
    return `/avatar/${userId}?v=${encodeURIComponent(trimmed)}`;
  }

  return safeHttpUrl(trimmed);
}
