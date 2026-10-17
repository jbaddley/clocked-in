"use client";

import { NetworkIcon } from "lucide-react";
import { LookupListCard } from "@/components/lookup-list";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";

export function DepartmentsView() {
  const { lookups } = useLookups();
  const copy = useLabels();
  return (
    <LookupListCard
      kind="departments"
      title={copy.departments}
      description={`Teams or sites inside this ${copy.organization.toLowerCase()}. Hours can be logged against a ${copy.department.toLowerCase()}, and reports break down by it.`}
      items={lookups.departments}
      icon={NetworkIcon}
    />
  );
}
