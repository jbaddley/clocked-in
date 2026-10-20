"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/hooks/use-workspace";
import { apiKeysQuery } from "@/lib/queries";

export function useApiKeys() {
  const organization = useOrganization();
  const query = useQuery(apiKeysQuery(organization.id));
  return { ...query, apiKeys: query.data ?? [] };
}
