"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { deleteNeedAction } from "@/app/actions/volunteer-needs";
import { NeedForm } from "@/app/(workspace)/needs/need-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { PageHeader } from "@/components/page-header";
import { SelectField } from "@/components/select-field";
import { PageSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useLookups } from "@/hooks/use-lookups";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { formatDate } from "@/lib/format";
import { keys, needsQuery } from "@/lib/queries";
import type { VolunteerNeed } from "@/lib/types";

type SortKey = "name" | "type" | "countVetted" | "startDate";

function dates(need: VolunteerNeed) {
  if (need.startDate && need.endDate) return `${formatDate(need.startDate)} – ${formatDate(need.endDate)}`;
  if (need.startDate) return formatDate(need.startDate);
  if (need.endDate) return formatDate(need.endDate);
  return "—";
}

export function NeedsView() {
  const router = useRouter();
  const organization = useOrganization();
  const { isAdmin, isCoordinator, permissions } = useWorkspace();
  const { names } = useLookups();
  useClientRedirect(!(isAdmin || isCoordinator || permissions.includes("create_needs")), "/dashboard");
  const { data, isPending } = useQuery(needsQuery(organization.id));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VolunteerNeed | null>(null);
  const remove = useActionMutation((id: string) => deleteNeedAction(id), {
    invalidate: [keys.needs(organization.id)],
    onSuccess: () => setPendingDelete(null),
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (data?.items ?? []).filter((need) => {
      if (type !== "all" && need.type !== type) return false;
      if (visibility === "public" && !need.allowPublic) return false;
      if (visibility === "private" && need.allowPublic) return false;
      if (!needle) return true;
      const project = need.projectId ? names.project.get(need.projectId) : "";
      const group = need.departmentId ? names.department.get(need.departmentId) : "";
      return `${need.name} ${need.description ?? ""} ${project ?? ""} ${group ?? ""}`.toLowerCase().includes(needle);
    });
    return [...filtered].sort((left, right) => {
      const a = sortKey === "countVetted" ? String(left.countVetted).padStart(6, "0") : (left[sortKey] ?? "");
      const b = sortKey === "countVetted" ? String(right.countVetted).padStart(6, "0") : (right[sortKey] ?? "");
      return a.localeCompare(b) * (sortDir === "asc" ? 1 : -1);
    });
  }, [data?.items, names.department, names.project, search, sortDir, sortKey, type, visibility]);

  if (!isAdmin) return <PageSkeleton rows={8} />;

  const columns: Column<VolunteerNeed>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      wrap: true,
      cell: (need) => need.name,
    },
    { key: "type", header: "Type", width: "7rem", cell: (need) => need.type },
    {
      key: "filled",
      header: "Filled",
      width: "6rem",
      cell: (need) => `${need.countVetted}/${need.countNeeded}`,
    },
    {
      key: "public",
      header: "Public",
      width: "6rem",
      cell: (need) => (need.allowPublic ? "Yes" : "No"),
    },
    {
      key: "vetting",
      header: "Vetting",
      width: "7rem",
      cell: (need) => (need.requireVetting ? "Required" : "Automatic"),
    },
    { key: "dates", header: "Dates", width: "12rem", wrap: true, cell: dates },
    {
      key: "delete",
      header: "",
      width: "3rem",
      cell: (need) => (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Delete ${need.name}`}
          onClick={(event) => {
            event.stopPropagation();
            setPendingDelete(need);
          }}
        >
          <Trash2Icon />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        description="Positions and tasks volunteers can fill."
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add need
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Input aria-label="Search needs" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <SelectField
          aria-label="Filter by type"
          value={type}
          options={[
            { value: "all", label: "All types" },
            { value: "Position", label: "Position" },
            { value: "Task", label: "Task" },
          ]}
          onValueChange={setType}
        />
        <SelectField
          aria-label="Filter by visibility"
          value={visibility}
          options={[
            { value: "all", label: "Public and private" },
            { value: "public", label: "Public" },
            { value: "private", label: "Private" },
          ]}
          onValueChange={setVisibility}
        />
        <SelectField
          aria-label="Sort needs"
          value={`${sortKey}:${sortDir}`}
          options={[
            { value: "name:asc", label: "Name A–Z" },
            { value: "name:desc", label: "Name Z–A" },
            { value: "type:asc", label: "Type" },
            { value: "countVetted:desc", label: "Most filled" },
            { value: "startDate:asc", label: "Start date" },
          ]}
          onValueChange={(value) => {
            const [key, dir] = value.split(":");
            setSortKey(key as SortKey);
            setSortDir(dir === "desc" ? "desc" : "asc");
          }}
        />
      </div>
      {isPending ? (
        <PageSkeleton rows={6} />
      ) : (
        <DataTable rows={rows} columns={columns} rowKey={(need) => need.id} onRowClick={(need) => router.push(`/needs/${need.id}`)} />
      )}
      <EntityFormDialog open={creating} onOpenChange={setCreating} title="Add need" className="sm:max-w-2xl">
        <NeedForm onDone={() => setCreating(false)} />
      </EntityFormDialog>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this need?"
        description="Signups for this need are removed. Guest records stay."
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
        }}
      />
    </>
  );
}
