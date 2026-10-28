"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { editFeedbackAction, updateFeedbackAction } from "@/app/actions/feedback";
import { Field, FormMessage } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { PageSkeleton } from "@/components/skeletons";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useWorkspace } from "@/hooks/use-workspace";
import type { FeedbackArea, FeedbackPriority, FeedbackStatus, FeedbackType } from "@/lib/api/json";
import { HttpError } from "@/lib/fetch-json";
import { feedbackAreas, feedbackLabel, feedbackPriorities, feedbackStatuses, feedbackTypes } from "@/lib/feedback";
import { feedbackItemQuery, keys } from "@/lib/queries";
import type { ActionResult, Feedback } from "@/lib/types";
import { safeHttpUrl } from "@/lib/url";
import { formatPersonName } from "@/lib/format";

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

function loadError(error: Error) {
  if (error instanceof HttpError && error.status === 404) {
    return "This feedback was not found.";
  }

  if (error instanceof HttpError && error.status === 403) {
    return "Only the sender, an organization admin, or a super admin can open this feedback.";
  }

  return error.message;
}

export function FeedbackDetail({ id }: { id: string }) {
  const { viewer } = useWorkspace();
  const { data, isPending, error } = useQuery(feedbackItemQuery(id));

  return (
    <div className="grid gap-6">
      <Link
        href="/feedback"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        All feedback
      </Link>
      {isPending ? <PageSkeleton rows={8} /> : null}
      {error ? <p className="text-sm text-muted-foreground">{loadError(error)}</p> : null}
      {data ? <FeedbackBody feedback={data} canUpdateStatus={viewer.isSuperAdmin} /> : null}
    </div>
  );
}

function FeedbackBody({ feedback, canUpdateStatus }: { feedback: Feedback; canUpdateStatus: boolean }) {
  const screenshots = feedback.screenshotUrls
    .map((url) => safeHttpUrl(url))
    .filter((url): url is string => Boolean(url));

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{feedback.title}</h2>
        <p className="text-sm text-muted-foreground">
          {feedbackLabel(feedbackStatuses, feedback.status)} · {formatWhen(feedback.createdAt)}
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <Meta label="Type" value={feedbackLabel(feedbackTypes, feedback.type)} />
        <Meta label="Priority" value={feedbackLabel(feedbackPriorities, feedback.priority)} />
        <Meta label="Area" value={feedbackLabel(feedbackAreas, feedback.area)} />
        <Meta label="From" value={`${formatPersonName(feedback.user)} (${feedback.user.username})`} />
        <Meta label="Organization" value={feedback.organization?.name ?? "—"} />
        <Meta
          label="GitHub"
          value={
            feedback.ticketUrl ? (
              <a
                href={feedback.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {feedback.githubIssueNumber ? `#${feedback.githubIssueNumber}` : "Open issue"}
              </a>
            ) : (
              "—"
            )
          }
        />
      </dl>
      <p className="whitespace-pre-wrap text-sm leading-6">{feedback.description}</p>
      {screenshots.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {screenshots.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Screenshot ${index + 1}`}
                className="max-h-96 w-full rounded-xl object-contain ring-1 ring-foreground/10"
              />
            </a>
          ))}
        </div>
      ) : null}
      <EditFeedbackForm key={`${feedback.id}:${feedback.updatedAt}`} feedback={feedback} />
      {canUpdateStatus ? <StatusForm key={`${feedback.id}:${feedback.status}:${feedback.actions.length}`} feedback={feedback} /> : null}
      {feedback.actions.length ? <ActionHistory feedback={feedback} /> : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EditFeedbackForm({ feedback }: { feedback: Feedback }) {
  const [type, setType] = useState(feedback.type);
  const [priority, setPriority] = useState(feedback.priority);
  const [area, setArea] = useState(feedback.area);
  const edit = useActionMutation(editFeedbackAction, {
    invalidate: [keys.feedback(true), keys.feedback(false), keys.feedbackItem(feedback.id)],
    errorToast: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit feedback</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            edit.mutate({
              id: feedback.id,
              type,
              priority,
              area,
              title: String(form.get("title") ?? ""),
              description: String(form.get("description") ?? ""),
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type" htmlFor="edit-type">
              <SelectField
                id="edit-type"
                value={type}
                onValueChange={(value) => setType(value as FeedbackType)}
                options={feedbackTypes}
              />
            </Field>
            <Field label="Priority" htmlFor="edit-priority">
              <SelectField
                id="edit-priority"
                value={priority}
                onValueChange={(value) => setPriority(value as FeedbackPriority)}
                options={feedbackPriorities}
              />
            </Field>
            <Field label="Area" htmlFor="edit-area">
              <SelectField
                id="edit-area"
                value={area}
                onValueChange={(value) => setArea(value as FeedbackArea)}
                options={feedbackAreas}
              />
            </Field>
          </div>
          <Field label="Title" htmlFor="edit-title">
            <Input id="edit-title" name="title" required maxLength={120} defaultValue={feedback.title} className="h-9" />
          </Field>
          <Field label="Description" htmlFor="edit-description">
            <Textarea
              id="edit-description"
              name="description"
              required
              maxLength={4000}
              rows={5}
              defaultValue={feedback.description}
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <FormMessage result={edit.error ? ({ ok: false, error: edit.error.message } satisfies ActionResult) : null} />
            <SubmitButton pending={edit.isPending}>Save feedback</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusForm({ feedback }: { feedback: Feedback }) {
  const [status, setStatus] = useState(feedback.status);
  const update = useActionMutation(updateFeedbackAction, {
    invalidate: [keys.feedback(true), keys.feedback(false), keys.feedbackItem(feedback.id)],
    errorToast: false,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update status</CardTitle>
      </CardHeader>
      <CardContent>
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
          <Field
            label="Ticket URL"
            htmlFor="feedback-ticket"
            hint="Optional extra ticket URL. GitHub issues are created automatically."
          >
            <Input id="feedback-ticket" name="ticketUrl" type="url" className="h-9" />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <FormMessage
              result={update.error ? ({ ok: false, error: update.error.message } satisfies ActionResult) : null}
            />
            <SubmitButton pending={update.isPending}>Save status</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ActionHistory({ feedback }: { feedback: Feedback }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Updates</h3>
      <ol className="grid gap-3">
        {feedback.actions.map((action) => (
          <li key={action.id} className="grid gap-1 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
            <p className="font-medium">
              {feedbackLabel(feedbackStatuses, action.previousStatus as FeedbackStatus)} to{" "}
              {feedbackLabel(feedbackStatuses, action.updatedStatus as FeedbackStatus)}
            </p>
            <p className="text-muted-foreground">
              {action.takenBy.displayName || action.takenBy.username} · {formatWhen(action.updatedAt)}
            </p>
            <p className="whitespace-pre-wrap leading-6">{action.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
