"use client";

import { LayersIcon, TagsIcon } from "lucide-react";
import { LookupListCard } from "@/components/lookup-list";
import { PageSkeleton } from "@/components/skeletons";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { ProjectsCard } from "./projects-card";

export function ListsView() {
  const { lookups, isPending } = useLookups();
  const copy = useLabels();
  if (isPending) return <PageSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-6">
      <ProjectsCard />
      <div className="grid gap-6 xl:grid-cols-2">
        <LookupListCard
          kind="categories"
          title={copy.taskCategories}
          description="What kind of work was this? Used in reports."
          items={lookups.categories}
          icon={LayersIcon}
        />
        <LookupListCard
          kind="tags"
          title="Tags"
          description="Free-form labels volunteers can attach to an entry."
          items={lookups.tags}
          icon={TagsIcon}
        />
      </div>
    </div>
  );
}
