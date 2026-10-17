"use client";

import { useState } from "react";
import { createHourlyRateAction, deleteHourlyRateAction, updateHourlyRateAction } from "@/app/actions/hourly-rates";
import { Field } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useLookups } from "@/hooks/use-lookups";
import { useOrganization } from "@/hooks/use-workspace";
import { formatCurrency } from "@/lib/format";
import { keys } from "@/lib/queries";
import type { HourlyRate } from "@/lib/types";

const types = [
  { value: "Volunteer", label: "Volunteer" },
  { value: "Professional", label: "Professional" },
];

export function HourlyRatesCard() {
  const organization = useOrganization();
  const { lookups } = useLookups();
  const invalidate = [keys.lookups(organization.id), keys.organization(organization.id)];
  const [name, setName] = useState("");
  const [type, setType] = useState("Volunteer");
  const [perHourRate, setPerHourRate] = useState("35.47");
  const [isDefault, setIsDefault] = useState(false);
  const create = useActionMutation(
    () =>
      createHourlyRateAction(organization.id, {
        type,
        name,
        perHourRate: Number(perHourRate),
        isDefault: type === "Volunteer" && isDefault,
      }),
    {
      invalidate,
      onSuccess: () => {
        setName("");
        setIsDefault(false);
      },
    },
  );
  const update = useActionMutation(
    ({ rateId, patch }: { rateId: string; patch: { isDefault?: boolean; isArchived?: boolean } }) =>
      updateHourlyRateAction(rateId, patch),
    { invalidate },
  );
  const remove = useActionMutation((rateId: string) => deleteHourlyRateAction(rateId), { invalidate });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hourly rates</CardTitle>
        <CardDescription>
          Each organization needs one default volunteer rate. Archived rates stay here but cannot be selected on new
          entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Name" htmlFor="rate-name">
            <Input id="rate-name" value={name} onChange={(event) => setName(event.target.value)} required className="h-9" />
          </Field>
          <Field label="Type">
            <SelectField
              value={type}
              onValueChange={(next) => {
                setType(next);
                if (next !== "Volunteer") setIsDefault(false);
              }}
              options={types}
              className="h-9"
            />
          </Field>
          <Field label="Per hour" htmlFor="rate-amount">
            <Input
              id="rate-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={perHourRate}
              onChange={(event) => setPerHourRate(event.target.value)}
              required
              className="h-9"
            />
          </Field>
          <SubmitButton pending={create.isPending} className="h-9 sm:mt-6">
            Add rate
          </SubmitButton>
        </form>
        {type === "Volunteer" ? (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
            Make this the default volunteer rate
          </label>
        ) : null}
        <ul className="divide-y rounded-lg border">
          {lookups.hourlyRates.map((rate) => (
            <RateRow
              key={rate.id}
              rate={rate}
              pending={update.isPending || remove.isPending}
              onDefault={() => update.mutate({ rateId: rate.id, patch: { isDefault: true } })}
              onArchive={() => update.mutate({ rateId: rate.id, patch: { isArchived: !rate.isArchived } })}
              onDelete={() => remove.mutate(rate.id)}
            />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RateRow({
  rate,
  pending,
  onDefault,
  onArchive,
  onDelete,
}: {
  rate: HourlyRate;
  pending: boolean;
  onDefault: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{rate.name}</p>
        <p className="text-xs text-muted-foreground">
          {rate.type} · {formatCurrency(rate.perHourRate)}/h
        </p>
      </div>
      {rate.isDefault ? <Badge>Default</Badge> : null}
      {rate.isArchived ? <Badge variant="outline">Archived</Badge> : null}
      {rate.type === "Volunteer" && !rate.isDefault ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDefault}>
          Make default
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" disabled={pending || rate.isDefault} onClick={onArchive}>
        {rate.isArchived ? "Unarchive" : "Archive"}
      </Button>
      {rate.isDefault ? null : (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDelete}>
          Delete
        </Button>
      )}
    </li>
  );
}
