"use client";

import { useOrganization } from "@/hooks/use-workspace";
import { labels } from "@/lib/labels";

export function useLabels() {
  return labels(useOrganization().preferences);
}
