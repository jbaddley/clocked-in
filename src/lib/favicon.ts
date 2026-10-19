import type { Metadata } from "next";
import { brandAssetSrc } from "@/lib/brand";

type Icon = { url: string; sizes?: string; type?: string };

export const defaultIcons = {
  icon: [
    { url: "/favicon.ico", sizes: "any" },
    { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
  ],
  apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
} satisfies NonNullable<Metadata["icons"]>;

export function orgMarkIcon(storedUrl: string | null): Icon | null {
  const url = brandAssetSrc("mark", storedUrl);
  if (!url) {
    return null;
  }

  if (url.startsWith("/brand/")) {
    return { url, type: "image/webp", sizes: "64x64" };
  }

  return { url };
}
