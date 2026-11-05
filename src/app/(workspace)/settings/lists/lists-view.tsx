"use client";

import { LayersIcon, TagsIcon } from "lucide-react";
import { LookupListCard } from "@/components/lookup-list";
import { PageSkeleton } from "@/components/skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useWorkspace } from "@/hooks/use-workspace";
import { ProjectsCard } from "./projects-card";

export function ListsView() {
  const { lookups, isPending } = useLookups();
  const { isAdmin } = useWorkspace();
  const copy = useLabels();
  if (isPending) return <PageSkeleton rows={6} />;

  return (
    <Tabs defaultValue="projects">
      <TabsList variant="line">
        <TabsTrigger value="projects">{copy.projects}</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
        {isAdmin ? <TabsTrigger value="categories">{copy.taskCategories}</TabsTrigger> : null}
        {isAdmin ? <TabsTrigger value="tags">Tags</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="projects" className="mt-4">
        <ProjectsCard projectType="Project" />
      </TabsContent>
      <TabsContent value="events" className="mt-4">
        <ProjectsCard projectType="Event" />
      </TabsContent>
      {isAdmin ? (
        <TabsContent value="categories" className="mt-4">
          <LookupListCard
            kind="categories"
            title={copy.taskCategories}
            description="What kind of work was this? Used in reports."
            items={lookups.categories}
            icon={LayersIcon}
          />
        </TabsContent>
      ) : null}
      {isAdmin ? (
        <TabsContent value="tags" className="mt-4">
          <LookupListCard
            kind="tags"
            title="Tags"
            description="Free-form labels volunteers can attach to an entry."
            items={lookups.tags}
            icon={TagsIcon}
          />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
