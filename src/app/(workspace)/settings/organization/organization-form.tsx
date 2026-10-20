"use client";

import { useActionState, useMemo, useState } from "react";
import { updateOrganizationSettingsAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/hooks/use-labels";
import { useMembers } from "@/hooks/use-members";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { selectableMembers } from "@/components/person-select";
import { HourlyRatesCard } from "./hourly-rates-card";

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
          Name, valuation year, time editing, and what to call {copy.projects.toLowerCase()} and{" "}
          {copy.departments.toLowerCase()} are saved together.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required defaultValue={organization.name} className="h-9" />
          </Field>
          <Field label="Rate source year" htmlFor="rateSourceYear">
            <Input
              id="rateSourceYear"
              name="rateSourceYear"
              type="number"
              min="2000"
              max="2100"
              required
              defaultValue={organization.rateSourceYear}
              className="h-9"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              name="allowTimeEntryEditing"
              defaultChecked={organization.preferences.allowTimeEntryEditing}
              className="size-4 rounded border"
            />
            Allow time entry editing
          </label>
          <p className="text-sm text-muted-foreground sm:col-span-2">
            When this is off, saved entries keep their start, end, and duration. {copy.project}, {copy.taskCategory.toLowerCase()}, and notes can still change.
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

function FeedbackNotifyField({ defaultIds }: { defaultIds: string[] }) {
  const { viewer } = useWorkspace();
  const { members } = useMembers({ enabled: true });
  const options = useMemo(
    () => selectableMembers(members, viewer.id, { activeOnly: true }),
    [members, viewer.id],
  );
  const [selected, setSelected] = useState<string[]>(defaultIds);

  function toggle(userId: string, checked: boolean) {
    setSelected((current) => (checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId)));
  }

  return (
    <div className="grid gap-2 sm:col-span-2">
      <Field label="Feedback email list">
        <p className="text-sm text-muted-foreground">
          Active people here are emailed when someone in this organization sends feedback. SuperAdmins are always notified.
        </p>
      </Field>
      <input type="hidden" name="feedbackNotifyUserIds" value={selected.join(",")} />
      <ul className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
        {options.map((member) => {
          const label =
            member.user.displayName?.trim() ||
            [member.user.firstName, member.user.lastName].filter(Boolean).join(" ").trim() ||
            member.user.username;
          const checked = selected.includes(member.userId);
          return (
            <li key={member.userId} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={checked}
                onCheckedChange={(value) => toggle(member.userId, value === true)}
                aria-label={label}
              />
              <span>{label}</span>
            </li>
          );
        })}
        {options.length === 0 ? <li className="text-sm text-muted-foreground">No active members yet.</li> : null}
      </ul>
    </div>
  );
}
