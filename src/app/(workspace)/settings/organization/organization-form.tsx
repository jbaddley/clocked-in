"use client";

import { useActionState, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { updateOrganizationSettingsAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/hooks/use-labels";
import { useMembers } from "@/hooks/use-members";
import { useOrganization } from "@/hooks/use-workspace";
import type { Membership } from "@/lib/types";
import { HourlyRatesCard } from "./hourly-rates-card";
import { formatPersonName } from "@/lib/format";

export function OrganizationForm() {
  const organization = useOrganization();
  return (
    <>
      <OrganizationFields key={`${organization.id}:${JSON.stringify(organization.preferences)}`} />
      <HourlyRatesCard />
    </>
  );
}

function OrganizationFields() {
  const organization = useOrganization();
  const copy = useLabels();
  const [result, action] = useActionState(updateOrganizationSettingsAction.bind(null, organization.id), null);
  const labels = organization.preferences.entityLabels;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.organization}</CardTitle>
        <CardDescription>
          Time editing, volunteer connections, and what to call {copy.projects.toLowerCase()} and{" "}
          {copy.departments.toLowerCase()} are saved together.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox name="allowTimeEntryEditing" value="on" defaultChecked={organization.preferences.allowTimeEntryEditing} />
            Allow time entry editing
          </label>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            When this is off, saved entries keep their start, end, and duration. {copy.project}, {copy.taskCategory.toLowerCase()}, and notes can still change.
          </p>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox name="allowVolunteersToAddVolunteers" value="on" defaultChecked={organization.preferences.allowVolunteersToAddVolunteers} />
            Allow volunteers to add volunteers
          </label>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            When this is on, a volunteer can create another volunteer and record how they are related. Volunteers can log time for people they are connected to.
          </p>
          <Field label={`${copy.organization} label`} htmlFor="labelOrganization">
            <Input id="labelOrganization" name="labelOrganization" required defaultValue={labels.organization} className="h-9" />
          </Field>
          <Field label={`${copy.project} label`} htmlFor="labelProject">
            <Input id="labelProject" name="labelProject" required defaultValue={labels.project} className="h-9" />
          </Field>
          <Field label={`${copy.department} label`} htmlFor="labelDepartment">
            <Input id="labelDepartment" name="labelDepartment" required defaultValue={labels.department} className="h-9" />
          </Field>
          <Field label={`${copy.taskCategory} label`} htmlFor="labelTaskCategory">
            <Input id="labelTaskCategory" name="labelTaskCategory" required defaultValue={labels.taskCategory} className="h-9" />
          </Field>
          <Field label="Public openings slug" htmlFor="publicSlug" hint="Share /openings/{slug} on your website.">
            <Input id="publicSlug" name="publicSlug" defaultValue={organization.publicSlug ?? ""} className="h-9" />
          </Field>
          <FeedbackNotifyField defaultIds={organization.preferences.feedbackNotifyUserIds ?? []} />
          <div className="flex items-end justify-between gap-3 sm:col-span-2">
            <FormMessage result={result} />
            <SubmitButton className="h-9 ml-auto">Save settings</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function personSearch(member: Membership) {
  return [formatPersonName(member.user), member.user.username, member.user.email].filter(Boolean).join(" ").toLowerCase();
}

function FeedbackNotifyField({ defaultIds }: { defaultIds: string[] }) {
  const { members, isPending } = useMembers({ enabled: true });
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(defaultIds);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = draft.trim().toLowerCase();
  const suggestions =
    query.length === 0
      ? []
      : members
          .filter(
            (member) =>
              member.isActive === true && !selected.includes(member.userId) && personSearch(member).includes(query),
          )
          .slice(0, 8);
  const chosen = selected.map((id) => {
    const member = members.find((item) => item.userId === id);
    return {
      id,
      name: member ? formatPersonName(member.user) : isPending ? "" : "Former member",
    };
  });

  function select(userId: string) {
    setSelected((current) => (current.includes(userId) ? current : [...current, userId]));
    setDraft("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(userId: string) {
    setSelected((current) => current.filter((id) => id !== userId));
    inputRef.current?.focus();
  }

  return (
    <Field
      label="Who receives feedback"
      hint="These people are emailed when someone in this organization sends feedback."
      className="sm:col-span-2"
    >
      <input type="hidden" name="feedbackNotifyUserIds" value={selected.join(",")} />
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        {chosen.map((person) => (
          <span
            key={person.id}
            className="inline-flex h-6 max-w-full items-center gap-0.5 rounded-full bg-secondary pr-0.5 pl-2 text-xs text-secondary-foreground"
          >
            <span className="truncate">{person.name}</span>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              aria-label={`Remove ${person.name || "person"}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => remove(person.id)}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          aria-label="Add a person"
          aria-expanded={open && query.length > 0}
          aria-controls="feedback-recipient-options"
          role="combobox"
          placeholder={chosen.length ? "" : "Add a person"}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setDraft(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const match = suggestions[active] ?? suggestions[0];
              if (match) select(match.userId);
            } else if (event.key === "Backspace" && !draft) {
              const last = selected[selected.length - 1];
              if (!last) return;
              event.preventDefault();
              remove(last);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && query.length > 0 ? (
        <ul
          id="feedback-recipient-options"
          className="mt-1 max-h-44 overflow-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
          role="listbox"
        >
          {suggestions.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">No matches</li>
          ) : (
            suggestions.map((member, index) => {
              const name = formatPersonName(member.user);
              return (
                <li key={member.userId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === active}
                    className="flex w-full rounded-md px-2 py-1.5 text-left hover:bg-muted aria-selected:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => select(member.userId)}
                  >
                    {name}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </Field>
  );
}
