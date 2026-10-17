"use client";

import { useActionState } from "react";
import { updateOrganizationSettingsAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLabels } from "@/hooks/use-labels";
import { useOrganization } from "@/hooks/use-workspace";
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
          <div className="flex items-end justify-between gap-3 sm:col-span-2">
            <FormMessage result={result} />
            <SubmitButton className="h-9 ml-auto">Save settings</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
