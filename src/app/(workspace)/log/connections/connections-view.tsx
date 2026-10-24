"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClockIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { createPersonAction, type NewPerson } from "@/app/actions/members";
import { TimeEntryForm } from "@/components/entity-forms/time-entry-form";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { Field, FormMessage } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useClientRedirect } from "@/hooks/use-client-redirect";
import { useLookups } from "@/hooks/use-lookups";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { connectionPersonName, memberRelationships, relationshipFor } from "@/lib/member-connection";
import { connectionsQuery, keys } from "@/lib/queries";
import { canLogConnectionTime } from "@/lib/roles";
import { SetupAlert } from "../setup-alert";

const relationshipOptions = memberRelationships.map((relationship) => ({ value: relationship, label: relationship }));

export function ConnectionsTimeView() {
  const { viewer, isAdmin, role } = useWorkspace();
  const organization = useOrganization();
  const connections = useQuery(connectionsQuery(organization.id));
  const canLog = canLogConnectionTime({
    role,
    isAdmin,
    allowVolunteersToAddVolunteers: organization.preferences.allowVolunteersToAddVolunteers,
    connectionCount: connections.data?.length ?? 0,
  });
  useClientRedirect(!connections.isPending && !canLog, "/log/own");
  const { lookups, isSuccess } = useLookups();
  const [adding, setAdding] = useState(false);
  const canAdd = role === "VOLUNTEER" && organization.preferences.allowVolunteersToAddVolunteers;
  if (!canLog && connections.isPending) return null;
  if (!canLog) return null;

  const mine = (connections.data ?? []).flatMap((connection) => {
    if (connection.userAId !== viewer.id && connection.userBId !== viewer.id) return [];
    const person = connection.userAId === viewer.id ? connection.userB : connection.userA;
    const relationship = relationshipFor(connection, viewer.id);
    return [{ userId: person.id, label: `${connectionPersonName(person)} (${relationship})` }];
  });
  const missingProject = isSuccess && lookups.projects.length === 0;
  const missingCategory = isSuccess && lookups.categories.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {missingProject || missingCategory ? (
        <SetupAlert isAdmin={isAdmin} missingProject={missingProject} missingCategory={missingCategory} action="save time" />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            Add time for a connection
          </CardTitle>
          <CardDescription>Choose someone you are connected to, then log start and end times or total hours.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canAdd ? (
            <div>
              <Button type="button" variant="outline" className="h-9" onClick={() => setAdding(true)}>
                <PlusIcon className="size-4" />
                Add volunteer
              </Button>
            </div>
          ) : null}
          {connections.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {canAdd ? "Add a volunteer to log time for them." : "You have no connections to log time for."}
            </p>
          ) : (
            <TimeEntryForm candidates={mine} />
          )}
        </CardContent>
      </Card>
      <EntityFormDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add volunteer"
        description="They will choose a new password the first time they sign in. Tell them how you are related."
      >
        <AddVolunteerForm onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />
      </EntityFormDialog>
    </div>
  );
}

function AddVolunteerForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const organization = useOrganization();
  const [relationship, setRelationship] = useState<string>(memberRelationships[0]);
  const create = useActionMutation((input: NewPerson) => createPersonAction(organization.id, input), {
    invalidate: [keys.members(organization.id), keys.connections(organization.id)],
    errorToast: false,
    onSuccess: onSaved,
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        create.mutate({
          email: String(data.get("email") ?? ""),
          username: String(data.get("username") ?? ""),
          password: String(data.get("password") ?? ""),
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          role: "VOLUNTEER",
          relationship,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="connection-firstName">
          <Input id="connection-firstName" name="firstName" required maxLength={100} className="h-9" />
        </Field>
        <Field label="Last name" htmlFor="connection-lastName">
          <Input id="connection-lastName" name="lastName" required maxLength={100} className="h-9" />
        </Field>
        <Field label="Email" htmlFor="connection-email">
          <Input id="connection-email" name="email" type="email" required className="h-9" />
        </Field>
        <Field label="Username" htmlFor="connection-username">
          <Input id="connection-username" name="username" required minLength={3} maxLength={50} className="h-9" />
        </Field>
        <Field
          label="Temporary password"
          htmlFor="connection-password"
          className="sm:col-span-2"
          hint="They will choose a new password the first time they sign in."
        >
          <Input id="connection-password" name="password" type="password" required minLength={8} className="h-9" />
        </Field>
        <Field label="This person is my" htmlFor="connection-relationship" className="sm:col-span-2">
          <SelectField
            id="connection-relationship"
            value={relationship}
            onValueChange={setRelationship}
            options={relationshipOptions}
            className="h-9"
          />
        </Field>
      </div>
      <FormMessage result={create.error ? { ok: false, error: create.error.message } : null} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pending={create.isPending} className="h-9">
          Add volunteer
        </SubmitButton>
      </div>
    </form>
  );
}
