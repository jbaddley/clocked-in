"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { updateFeedbackAction } from "@/app/actions/feedback";
import { DataTable, type Column } from "@/components/data-table";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { Field, FormMessage } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { SelectField } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageSkeleton } from "@/components/skeletons";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useWorkspace } from "@/hooks/use-workspace";
import type { FeedbackStatus } from "@/lib/api/json";
import { feedbackAreas, feedbackLabel, feedbackPriorities, feedbackStatuses, feedbackTypes } from "@/lib/feedback";
import { keys, feedbackQuery } from "@/lib/queries";
import type { ActionResult, Feedback } from "@/lib/types";

function personName(row: Feedback) {
  return row.user.displayName || row.user.username;
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

export function FeedbackView() {
  const { viewer } = useWorkspace();
  useClientRedirect(!viewer.isSuperAdmin, "/dashboard");
  if (!viewer.isSuperAdmin) return <PageSkeleton rows={8} />;

  return (
    <>
      <PageHeader description="Bugs and feature requests from everyone using Clocked In." />
      <Tabs defaultValue="active">
        <TabsList variant="line">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <FeedbackTable active />
        </TabsContent>
        <TabsContent value="inactive">
          <FeedbackTable active={false} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function FeedbackTable({ active }: { active: boolean }) {
  const { data, isPending } = useQuery(feedbackQuery(active));
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<"createdAt" | "title" | "priority" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Feedback | null>(null);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (data?.items ?? []).filter((row) => {
      if (type !== "all" && row.type !== type) return false;
      if (priority !== "all" && row.priority !== priority) return false;
      if (area !== "all" && row.area !== area) return false;
      if (status !== "all" && row.status !== status) return false;
      if (!needle) return true;
      return `${row.title} ${row.description} ${personName(row)}`.toLowerCase().includes(needle);
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
        <button type="button" className="uppercase" onClick={() => toggleSort("title")}>
          Title
        </button>
      ),
      primary: true,
      wrap: true,
      cell: (row) => row.title,
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => feedbackLabel(feedbackTypes, row.type),
    },
    {
      key: "priority",
      header: (
        <button type="button" className="uppercase" onClick={() => toggleSort("priority")}>
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
        <button type="button" className="uppercase" onClick={() => toggleSort("status")}>
          Status
        </button>
      ),
      cell: (row) => feedbackLabel(feedbackStatuses, row.status),
    },
    {
      key: "submitter",
      header: "From",
      cell: (row) => personName(row),
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
          <a href={row.ticketUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            {row.githubIssueNumber ? `#${row.githubIssueNumber}` : "Open"}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "createdAt",
      header: (
        <button type="button" className="uppercase" onClick={() => toggleSort("createdAt")}>
          Received
        </button>
      ),
      cell: (row) => formatWhen(row.createdAt),
    },
    ...(active
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: Feedback) => (
              <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                Update
              </Button>
            ),
          } satisfies Column<Feedback>,
        ]
      : []),
  ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="h-9" />
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
        <DataTable rows={rows} columns={columns} rowKey={(row) => row.id} />
      ) : (
        <p className="text-sm text-muted-foreground">No feedback in this list.</p>
      )}
      <UpdateFeedbackDialog feedback={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

function UpdateFeedbackDialog({
  feedback,
  onOpenChange,
}: {
  feedback: Feedback | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <EntityFormDialog
      open={Boolean(feedback)}
      onOpenChange={onOpenChange}
      title="Update feedback"
      description={feedback?.title}
      className="sm:max-w-lg"
    >
      {feedback ? <UpdateFeedbackForm feedback={feedback} onSaved={() => onOpenChange(false)} /> : null}
    </EntityFormDialog>
  );
}

function UpdateFeedbackForm({ feedback, onSaved }: { feedback: Feedback; onSaved: () => void }) {
  const [status, setStatus] = useState(feedback.status);
  const update = useActionMutation(updateFeedbackAction, {
    invalidate: [keys.feedback(true), keys.feedback(false)],
    onSuccess: onSaved,
    errorToast: false,
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        update.mutate({
          id: feedback.id,
          status,
          description: String(form.get("description") ?? ""),
          ticketUrl: String(form.get("ticketUrl") ?? "").trim() || undefined,
        });
      }}
    >
      <p className="text-sm text-muted-foreground">{feedback.description}</p>
      {feedback.ticketUrl ? (
        <p className="text-sm">
          GitHub issue:{" "}
          <a href={feedback.ticketUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
            {feedback.githubIssueNumber ? `#${feedback.githubIssueNumber}` : feedback.ticketUrl}
          </a>
        </p>
      ) : null}
      <Field label="Status" htmlFor="feedback-status">
        <SelectField
          id="feedback-status"
          value={status}
          onValueChange={(value) => setStatus(value as FeedbackStatus)}
          options={feedbackStatuses}
        />
      </Field>
      <Field label="Note" htmlFor="feedback-note">
        <Textarea id="feedback-note" name="description" required maxLength={2000} rows={4} />
      </Field>
      <Field label="Ticket URL" htmlFor="feedback-ticket" hint="Optional extra ticket URL. GitHub issues are created automatically.">
        <Input id="feedback-ticket" name="ticketUrl" type="url" className="h-9" />
      </Field>
      <div className="flex justify-end gap-2">
        <FormMessage
          result={
            update.error ? ({ ok: false, error: update.error.message } satisfies ActionResult) : null
          }
        />
        <SubmitButton pending={update.isPending}>Save</SubmitButton>
      </div>
    </form>
  );
}
