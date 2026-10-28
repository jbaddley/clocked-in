"use client";

import { MessageSquareIcon } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { SelectField } from "@/components/select-field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSkeleton } from "@/components/skeletons";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useWorkspace } from "@/hooks/use-workspace";
import { feedbackAreas, feedbackLabel, feedbackPriorities, feedbackStatuses, feedbackTypes } from "@/lib/feedback";
import { feedbackQuery } from "@/lib/queries";
import type { Feedback } from "@/lib/types";
import { formatPersonName } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

export function FeedbackView() {
  const { viewer } = useWorkspace();
  useClientRedirect(!viewer.isSuperAdmin, "/dashboard");
  if (!viewer.isSuperAdmin) return <PageSkeleton rows={8} />;

  return (
    <>
      <PageHeader description='Bugs and feature requests from everyone who uses the app.' />
      <Tabs defaultValue='active'>
        <TabsList variant='line'>
          <TabsTrigger value='active'>Active</TabsTrigger>
          <TabsTrigger value='inactive'>Inactive</TabsTrigger>
        </TabsList>
        <TabsContent value='active'>
          <FeedbackTable active />
        </TabsContent>
        <TabsContent value='inactive'>
          <FeedbackTable active={false} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function FeedbackTable({ active }: { active: boolean }) {
  const router = useRouter();
  const { data, isPending } = useQuery(feedbackQuery(active));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<"createdAt" | "title" | "priority" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (data?.items ?? []).filter((row) => {
      if (type !== "all" && row.type !== type) return false;
      if (priority !== "all" && row.priority !== priority) return false;
      if (area !== "all" && row.area !== area) return false;
      if (status !== "all" && row.status !== status) return false;
      if (!needle) return true;
      return `${row.title} ${row.description} ${formatPersonName(row.user)}`.toLowerCase().includes(needle);
    });
    const ranked = [...filtered].sort((left, right) => {
      const a = sortKey === "createdAt" ? left.createdAt : left[sortKey];
      const b = sortKey === "createdAt" ? right.createdAt : right[sortKey];
      return a.localeCompare(b) * (sortDir === "asc" ? 1 : -1);
    });
    return ranked;
  }, [area, data?.items, priority, search, sortDir, sortKey, status, type]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDir(key === "createdAt" ? "desc" : "asc");
  }

  const columns: Column<Feedback>[] = [
    {
      key: "title",
      header: (
        <button
          type='button'
          className='uppercase'
          onClick={(event) => {
            event.stopPropagation();
            toggleSort("title");
          }}
        >
          Title
        </button>
      ),
      primary: true,
      wrap: true,
      cell: (row) => (
        <Link
          href={`/feedback/${row.id}`}
          className='font-medium underline-offset-4 hover:underline'
          onClick={(event) => event.stopPropagation()}
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => feedbackLabel(feedbackTypes, row.type),
    },
    {
      key: "priority",
      header: (
        <button
          type='button'
          className='uppercase'
          onClick={(event) => {
            event.stopPropagation();
            toggleSort("priority");
          }}
        >
          Priority
        </button>
      ),
      cell: (row) => feedbackLabel(feedbackPriorities, row.priority),
    },
    {
      key: "area",
      header: "Area",
      cell: (row) => feedbackLabel(feedbackAreas, row.area),
    },
    {
      key: "status",
      header: (
        <button
          type='button'
          className='uppercase'
          onClick={(event) => {
            event.stopPropagation();
            toggleSort("status");
          }}
        >
          Status
        </button>
      ),
      cell: (row) => feedbackLabel(feedbackStatuses, row.status),
    },
    {
      key: "submitter",
      header: "From",
      cell: (row) => formatPersonName(row.user),
    },
    {
      key: "organization",
      header: "Organization",
      cell: (row) => row.organization?.name ?? "—",
    },
    {
      key: "ticket",
      header: "Ticket",
      cell: (row) =>
        row.ticketUrl ? (
          <a
            href={row.ticketUrl}
            target='_blank'
            rel='noreferrer'
            className='text-primary underline-offset-4 hover:underline'
            onClick={(event) => event.stopPropagation()}
          >
            {row.githubIssueNumber ? `#${row.githubIssueNumber}` : "Open"}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "createdAt",
      header: (
        <button
          type='button'
          className='uppercase'
          onClick={(event) => {
            event.stopPropagation();
            toggleSort("createdAt");
          }}
        >
          Received
        </button>
      ),
      cell: (row) => formatWhen(row.createdAt),
    },
  ];

  return (
    <div className='grid gap-4'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder='Search'
          aria-label='Search feedback'
          className='h-9'
        />
        <SelectField
          value={type}
          onValueChange={setType}
          options={[{ value: "all", label: "All types" }, ...feedbackTypes]}
        />
        <SelectField
          value={priority}
          onValueChange={setPriority}
          options={[{ value: "all", label: "All priorities" }, ...feedbackPriorities]}
        />
        <SelectField
          value={area}
          onValueChange={setArea}
          options={[{ value: "all", label: "All areas" }, ...feedbackAreas]}
        />
        <SelectField
          value={status}
          onValueChange={setStatus}
          options={[{ value: "all", label: "All statuses" }, ...feedbackStatuses]}
        />
      </div>
      {isPending ? (
        <PageSkeleton rows={8} />
      ) : rows.length ? (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/feedback/${row.id}`)}
        />
      ) : (
        <EmptyState icon={MessageSquareIcon} title="No feedback in this list" />
      )}
    </div>
  );
}
