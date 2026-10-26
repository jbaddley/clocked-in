"use client";

import { ChevronDownIcon, MoreVerticalIcon, PencilIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  createPersonAction,
  inviteDepartmentMemberAction,
  inviteMemberAction,
  removeMemberAction,
  removeMembersAction,
  revokeDepartmentInvitationAction,
  resendInvitationAction,
  revokeInvitationAction,
  updateMemberAction,
  type MemberPatch,
  type NewPerson,
} from "@/app/actions/members";
import { TimeEntryDialog } from "@/components/entity-forms/time-entry-form";
import { EntityFormDialog } from "@/components/entity-forms/entity-form-dialog";
import { Field, FormMessage } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageSkeleton } from "@/components/skeletons";
import { ConnectionsCard } from "./connections-card";
import { PersonProfileDialog } from "./person-profile-dialog";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useInvitations } from "@/hooks/use-invitations";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useMembers } from "@/hooks/use-members";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { fetchJson } from "@/lib/fetch-json";
import { formatInstant } from "@/lib/format";
import { keys } from "@/lib/queries";
import type { Invitation, Membership } from "@/lib/types";

const roles = [
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "MEMBER", label: "Staff" },
  { value: "ADMIN", label: "Admin" },
];

function roleLabel(code: string, fallback: string) {
  return roles.find((role) => role.value === code)?.label ?? fallback;
}

function personName(member: Membership) {
  const display = member.user.displayName?.trim();
  if (display) return display;
  const full = [member.user.firstName, member.user.lastName].filter(Boolean).join(" ").trim();
  return full || member.user.username;
}

function removalDescription(count: number, organizationName: string) {
  const people = count === 1 ? "1 person" : `${count} people`;
  const history = count === 1 ? "Their account and time history stay." : "Their accounts and time history stay.";
  return `${people} will lose access to ${organizationName}. ${history}`;
}

function departmentNames(member: Membership, departments: { id: string; name: string }[]) {
  return (member.departmentIds ?? [])
    .map((id) => departments.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InlineEmail({
  email,
  name,
  pending,
  onSave,
}: {
  email: string;
  name: string;
  pending?: boolean;
  onSave: (email: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(email);
  const skipSave = useRef(false);
  const editingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  editingRef.current = editing;

  useEffect(() => {
    if (!editingRef.current) setValue(email);
  }, [email]);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
  }, [editing]);

  function stopEditing(next = email) {
    skipSave.current = false;
    setValue(next);
    setEditing(false);
  }

  function commit(input: HTMLInputElement) {
    if (skipSave.current) {
      stopEditing();
      return;
    }

    const next = input.value.trim();
    if (next.toLowerCase() === email.trim().toLowerCase()) {
      stopEditing();
      return;
    }

    if (next.length > 254 || !emailPattern.test(next)) {
      toast.error("email must be an email address.");
      window.setTimeout(() => input.focus(), 0);
      return;
    }

    setValue(next);
    setEditing(false);
    void onSave(next).catch(() => setValue(email));
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        autoFocus
        type="email"
        inputMode="email"
        autoComplete="off"
        spellCheck={false}
        aria-label={`Email for ${name}`}
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={(event) => commit(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            skipSave.current = true;
            event.currentTarget.blur();
          }
        }}
        className="h-8"
      />
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <span className="min-w-0 truncate text-sm text-muted-foreground">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="ml-auto shrink-0 text-muted-foreground"
        aria-label={`Edit email for ${name}`}
        disabled={pending}
        onClick={() => {
          setValue(email);
          setEditing(true);
        }}
      >
        <PencilIcon />
      </Button>
    </div>
  );
}

function DepartmentSummary({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-muted-foreground">—</span>;
  if (names.length === 1) return <span className="truncate text-muted-foreground">{names[0]}</span>;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="text-muted-foreground underline decoration-dotted underline-offset-2"
            aria-label={`${names.length} departments: ${names.join(", ")}`}
          />
        }
      >
        {names.length} departments
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <ul className="flex flex-col gap-0.5 text-left">
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function MembersView() {
  const organization = useOrganization();
  const copy = useLabels();
  const { viewer, isAdmin, isCoordinator, groupDepartments } = useWorkspace();
  const { members: allMembers, isPending: membersPending } = useMembers();
  const members = isCoordinator
    ? allMembers.filter((member) => (member.departmentIds ?? []).some((id) => groupDepartments.includes(id)))
    : allMembers;
  const { lookups, isPending: lookupsPending } = useLookups();
  const [selected, setSelected] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<Membership | null>(null);
  const [profileMember, setProfileMember] = useState<Membership | null>(null);
  const [removeMember, setRemoveMember] = useState<Membership | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<Membership[] | null>(null);
  const [timeFor, setTimeFor] = useState<string[] | null>(null);
  const invalidate = [keys.members(organization.id)];
  const update = useActionMutation(
    ({ membershipId, patch }: { membershipId: string; patch: MemberPatch }) =>
      updateMemberAction(organization.id, membershipId, patch),
    { invalidate },
  );
  const [emailSavingId, setEmailSavingId] = useState<string | null>(null);
  const saveEmail = useActionMutation(
    ({ membershipId, email }: { membershipId: string; email: string }) =>
      updateMemberAction(organization.id, membershipId, { email }),
    { invalidate, silent: true, onSuccess: () => toast.success("Email saved.") },
  );

  async function saveMemberEmail(membershipId: string, email: string) {
    setEmailSavingId(membershipId);
    try {
      await saveEmail.mutateAsync({ membershipId, email });
    } finally {
      setEmailSavingId((current) => (current === membershipId ? null : current));
    }
  }
  const remove = useActionMutation(
    (membershipId: string) => removeMemberAction(organization.id, membershipId),
    { invalidate, onSuccess: () => setRemoveMember(null) },
  );
  const removeMany = useActionMutation(
    (membershipIds: string[]) => removeMembersAction(organization.id, membershipIds),
    {
      invalidate,
      onSuccess: () => {
        setPendingRemoval(null);
        setSelected([]);
      },
    },
  );

  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const allSelected = members.length > 0 && members.every((member) => selectedIds.has(member.id));
  if (membersPending || lookupsPending) return <PageSkeleton rows={8} />;

  return (
    <div className="flex flex-col gap-6">
      <InviteForm />
      {isAdmin ? <ConnectionsCard /> : null}
      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>
            Volunteers log their own time, and time for people they are connected to. Admins can log time for others.
            Removing someone leaves the account and their history.
          </CardDescription>
          <CardAction className="flex flex-col items-end gap-2">
            {isAdmin ? (
              <Button type="button" className="h-9" onClick={() => setAddOpen(true)}>
                Add person
              </Button>
            ) : null}
            {selected.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" className="h-9" />}>
                  Actions
                  <ChevronDownIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setTimeFor(members.filter((member) => selectedIds.has(member.id)).map((member) => member.userId))
                    }
                  >
                    Add time
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setPendingRemoval(members.filter((member) => selectedIds.has(member.id)))}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        setSelected(checked === true ? members.map((member) => member.id) : []);
                      }}
                      aria-label="Select all people"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>{copy.departments}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} data-state={selectedIds.has(member.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onCheckedChange={(checked) => {
                          setSelected((current) =>
                            checked === true ? [...current, member.id] : current.filter((id) => id !== member.id),
                          );
                        }}
                        aria-label={`Select ${personName(member)}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => setProfileMember(member)}
                      >
                        {personName(member)}
                      </button>
                      {member.userId === viewer.id ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <InlineEmail
                        email={member.user.email}
                        name={personName(member)}
                        pending={emailSavingId === member.id}
                        onSave={(email) => saveMemberEmail(member.id, email)}
                      />
                    </TableCell>
                    <TableCell>{roleLabel(member.role.code, member.role.name)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <DepartmentSummary names={departmentNames(member, lookups.departments)} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.isActive === false ? "outline" : "secondary"}>
                        {member.isActive === false ? "Inactive" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <PersonActions
                        member={member}
                        onEdit={() => setEditMember(member)}
                        onRemove={() => setRemoveMember(member)}
                        onToggleActive={() =>
                          update.mutate({ membershipId: member.id, patch: { isActive: member.isActive === false } })
                        }
                        onAddTime={() => setTimeFor([member.userId])}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 px-4 md:hidden">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => {
                  setSelected(checked === true ? members.map((member) => member.id) : []);
                }}
                aria-label="Select all people"
              />
              Select all
            </label>
            <ul className="flex flex-col gap-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="rounded-xl border bg-background p-3 ring-1 ring-foreground/10 data-[state=selected]:bg-muted/40"
                  data-state={selectedIds.has(member.id) ? "selected" : undefined}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.has(member.id)}
                      onCheckedChange={(checked) => {
                        setSelected((current) =>
                          checked === true ? [...current, member.id] : current.filter((id) => id !== member.id),
                        );
                      }}
                      aria-label={`Select ${personName(member)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p>
                          <button
                            type="button"
                            className="font-medium hover:underline"
                            onClick={() => setProfileMember(member)}
                          >
                            {personName(member)}
                          </button>
                          {member.userId === viewer.id ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>
                          ) : null}
                        </p>
                        <PersonActions
                          member={member}
                          onEdit={() => setEditMember(member)}
                          onRemove={() => setRemoveMember(member)}
                          onToggleActive={() =>
                            update.mutate({ membershipId: member.id, patch: { isActive: member.isActive === false } })
                          }
                          onAddTime={() => setTimeFor([member.userId])}
                        />
                      </div>
                      <InlineEmail
                        email={member.user.email}
                        name={personName(member)}
                        pending={emailSavingId === member.id}
                        onSave={(email) => saveMemberEmail(member.id, email)}
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span>{roleLabel(member.role.code, member.role.name)}</span>
                        <Badge variant={member.isActive === false ? "outline" : "secondary"}>
                          {member.isActive === false ? "Inactive" : "Active"}
                        </Badge>
                        <DepartmentSummary names={departmentNames(member, lookups.departments)} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <PersonProfileDialog
        member={profileMember}
        departmentNames={profileMember ? departmentNames(profileMember, lookups.departments) : []}
        timeZone={viewer.timezone}
        onOpenChange={(open) => {
          if (!open) setProfileMember(null);
        }}
      />
      <PersonDialog open={addOpen} onOpenChange={setAddOpen} />
      <PersonDialog
        open={Boolean(editMember)}
        onOpenChange={(open) => {
          if (!open) setEditMember(null);
        }}
        member={editMember}
      />
      <TimeEntryDialog
        open={Boolean(timeFor)}
        onOpenChange={(open) => {
          if (!open) setTimeFor(null);
        }}
        userId={timeFor?.length === 1 ? timeFor[0] : undefined}
        userIds={timeFor && timeFor.length > 1 ? timeFor : undefined}
      />
      <AlertDialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => {
          if (!open && !removeMany.isPending) setPendingRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from organization?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval ? removalDescription(pendingRemoval.length, organization.name) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMany.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMany.isPending || !pendingRemoval?.length}
              onClick={() => {
                if (pendingRemoval?.length) removeMany.mutate(pendingRemoval.map((member) => member.id));
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(removeMember)} onOpenChange={(open) => { if (!open) setRemoveMember(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from organization?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeMember
                ? `${personName(removeMember)} will lose access to ${organization.name}. Their account and time history stay.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (removeMember) remove.mutate(removeMember.id);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PersonActions({
  member,
  onEdit,
  onRemove,
  onToggleActive,
  onAddTime,
}: {
  member: Membership;
  onEdit: () => void;
  onRemove: () => void;
  onToggleActive: () => void;
  onAddTime: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="icon-sm" className="shrink-0" aria-label="Actions" />}
      >
        <MoreVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onRemove}>Remove</DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleActive}>
          {member.isActive === false ? "Activate" : "Deactivate"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddTime}>Add Time</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InviteForm() {
  const organization = useOrganization();
  const { isAdmin, isCoordinator, groupDepartments } = useWorkspace();
  const { lookups } = useLookups();
  const coordinated = lookups.departments.filter((department) => groupDepartments.includes(department.id));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("VOLUNTEER");
  const [departmentId, setDepartmentId] = useState(coordinated[0]?.id ?? "");
  const { invitations } = useInvitations();
  const invalidate = [
    keys.invitations(organization.id),
    ...coordinated.map((department) => keys.departmentInvitations(department.id)),
    keys.members(organization.id),
  ];
  const invite = useActionMutation(
    (input: { email: string; role: string; departmentId?: string }) =>
      input.departmentId
        ? inviteDepartmentMemberAction(input.departmentId, input.email, input.role)
        : inviteMemberAction(organization.id, input.email, input.role),
    { invalidate, onSuccess: () => setEmail("") },
  );
  const revoke = useActionMutation(
    (invitation: Invitation) =>
      invitation.departmentId
        ? revokeDepartmentInvitationAction(invitation.departmentId, invitation.id)
        : revokeInvitationAction(organization.id, invitation.id),
    { invalidate },
  );
  const resend = useActionMutation(
    (invitation: Invitation) => resendInvitationAction(organization.id, invitation.id, invitation.email),
    { invalidate },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite someone</CardTitle>
        <CardDescription>We email them a 6-digit code and a link to enter it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate({ email, role, departmentId: isCoordinator ? departmentId || coordinated[0]?.id : undefined });
          }}
        >
          <Field label="Email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9"
            />
          </Field>
          {isCoordinator && coordinated.length > 1 ? (
            <Field label="Group">
              <SelectField
                value={departmentId || coordinated[0]?.id || ""}
                onValueChange={setDepartmentId}
                options={coordinated.map((department) => ({ value: department.id, label: department.name }))}
                className="h-9"
              />
            </Field>
          ) : null}
          <Field label="Role">
            <SelectField value={role} onValueChange={setRole} options={roles} className="h-9" />
          </Field>
          <SubmitButton pending={invite.isPending} className="h-9 sm:mt-6">
            Send invite
          </SubmitButton>
        </form>
        {invitations.length ? (
          <ul className="divide-y rounded-lg border">
            {invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                pending={revoke.isPending || resend.isPending}
                onRevoke={() => revoke.mutate(invitation)}
                onResend={invitation.departmentId ? undefined : () => resend.mutate(invitation)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No invitations yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function invitationStatus(invitation: Invitation) {
  if (invitation.acceptedAt) return { label: "Accepted", variant: "default" as const };
  if (invitation.revokedAt) return { label: "Revoked", variant: "outline" as const };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return { label: "Expired", variant: "destructive" as const };
  return { label: "Pending", variant: "secondary" as const };
}

function InvitationRow({
  invitation,
  pending,
  onRevoke,
  onResend,
}: {
  invitation: Invitation;
  pending: boolean;
  onRevoke: () => void;
  onResend?: () => void;
}) {
  const { viewer } = useWorkspace();
  const status = invitationStatus(invitation);
  const canResend = Boolean(onResend) && (status.label === "Pending" || status.label === "Expired");
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          {roleLabel(invitation.role.code, invitation.role.name)} · sent {formatInstant(invitation.createdAt, viewer.timezone)}
        </p>
      </div>
      <Badge variant={status.variant}>{status.label}</Badge>
      {canResend ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onResend}>
          Resend
        </Button>
      ) : null}
      {status.label === "Pending" ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onRevoke}>
          Revoke
        </Button>
      ) : null}
    </li>
  );
}

function PersonDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Membership | null;
}) {
  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? "Edit person" : "Add person"}
      description={member ? "Update their membership and profile." : "Create an account with a temporary password."}
      className="sm:max-w-lg"
    >
      {member ? (
        <EditPersonForm member={member} onCancel={() => onOpenChange(false)} onSaved={() => onOpenChange(false)} />
      ) : (
        <AddPersonForm onCancel={() => onOpenChange(false)} onSaved={() => onOpenChange(false)} />
      )}
    </EntityFormDialog>
  );
}

function AddPersonForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const organization = useOrganization();
  const [role, setRole] = useState("VOLUNTEER");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [emailUser, setEmailUser] = useState(true);
  const create = useActionMutation((input: NewPerson) => createPersonAction(organization.id, input), {
    invalidate: [keys.members(organization.id)],
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
          role,
          departmentIds,
          emailUser,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="add-firstName">
          <Input id="add-firstName" name="firstName" required maxLength={100} className="h-9" />
        </Field>
        <Field label="Last name" htmlFor="add-lastName">
          <Input id="add-lastName" name="lastName" required maxLength={100} className="h-9" />
        </Field>
        <Field label="Email" htmlFor="add-email">
          <Input id="add-email" name="email" type="email" required className="h-9" />
        </Field>
        <Field label="Username" htmlFor="add-username">
          <Input id="add-username" name="username" required minLength={3} maxLength={50} className="h-9" />
        </Field>
        <Field
          label="Temporary password"
          htmlFor="add-password"
          className="sm:col-span-2"
          hint="They will choose a new password the first time they sign in."
        >
          <Input id="add-password" name="password" type="password" required minLength={8} className="h-9" />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={emailUser} onCheckedChange={(checked) => setEmailUser(checked === true)} />
            Email user
          </label>
          <p className="text-xs text-muted-foreground">
            They will get an email with their username and temporary password.
          </p>
        </div>
        <Field label="Role">
          <SelectField value={role} onValueChange={setRole} options={roles} className="h-9" />
        </Field>
      </div>
      <DepartmentChecks value={departmentIds} onChange={setDepartmentIds} />
      <FormMessage result={create.error ? { ok: false, error: create.error.message } : null} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pending={create.isPending} className="h-9">
          Add person
        </SubmitButton>
      </div>
    </form>
  );
}

function EditPersonForm({
  member,
  onCancel,
  onSaved,
}: {
  member: Membership;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const organization = useOrganization();
  const [role, setRole] = useState(member.role.code);
  const [departmentIds, setDepartmentIds] = useState(member.departmentIds ?? []);
  const [profile, setProfile] = useState({
    email: member.user.email,
    firstName: member.user.firstName ?? "",
    lastName: member.user.lastName ?? "",
    displayName: member.user.displayName ?? "",
    timezone: "UTC",
    phone: "",
    zipCode: "",
    notes: "",
  });
  const save = useActionMutation(
    (patch: MemberPatch) => updateMemberAction(organization.id, member.id, patch),
    { invalidate: [keys.members(organization.id)], errorToast: false, onSuccess: onSaved },
  );

  useEffect(() => {
    let cancelled = false;
    fetchJson<{
      email: string;
      profile: {
        firstName: string;
        lastName: string;
        displayName: string | null;
        timezone: string;
        phone: string | null;
        zipCode: string | null;
        notes: string | null;
      } | null;
    }>(`/users/${member.userId}`)
      .then((user) => {
        if (cancelled || !user.profile) return;
        setProfile({
          email: user.email,
          firstName: user.profile.firstName,
          lastName: user.profile.lastName,
          displayName: user.profile.displayName ?? "",
          timezone: user.profile.timezone,
          phone: user.profile.phone ?? "",
          zipCode: user.profile.zipCode ?? "",
          notes: user.profile.notes ?? "",
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [member.userId]);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          role,
          departmentIds,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          displayName: profile.displayName.trim() || null,
          timezone: profile.timezone,
          phone: profile.phone.trim() || null,
          zipCode: profile.zipCode.trim() || null,
          notes: profile.notes.trim() || null,
        });
      }}
    >
      <Tabs defaultValue="membership">
        <TabsList>
          <TabsTrigger value="membership">Membership</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="membership" className="mt-4 flex flex-col gap-4">
          <Field label="Role">
            <SelectField value={role} onValueChange={setRole} options={roles} className="h-9" />
          </Field>
          <DepartmentChecks value={departmentIds} onChange={setDepartmentIds} />
        </TabsContent>
        <TabsContent value="profile" className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="edit-email" className="sm:col-span-2" hint="Invite and password codes go to this address.">
            <Input
              id="edit-email"
              type="email"
              autoComplete="email"
              value={profile.email}
              onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              required
              maxLength={254}
              className="h-9"
            />
          </Field>
          <Field label="First name" htmlFor="edit-firstName">
            <Input
              id="edit-firstName"
              value={profile.firstName}
              onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
              required
              className="h-9"
            />
          </Field>
          <Field label="Last name" htmlFor="edit-lastName">
            <Input
              id="edit-lastName"
              value={profile.lastName}
              onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
              required
              className="h-9"
            />
          </Field>
          <Field label="Display name" htmlFor="edit-displayName" className="sm:col-span-2">
            <Input
              id="edit-displayName"
              value={profile.displayName}
              onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="Timezone" htmlFor="edit-timezone">
            <Input
              id="edit-timezone"
              value={profile.timezone}
              onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="Phone" htmlFor="edit-phone">
            <Input
              id="edit-phone"
              value={profile.phone}
              onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="Zip code" htmlFor="edit-zipCode">
            <Input
              id="edit-zipCode"
              value={profile.zipCode}
              onChange={(event) => setProfile({ ...profile, zipCode: event.target.value })}
              className="h-9"
            />
          </Field>
          <Field label="Notes" htmlFor="edit-notes" className="sm:col-span-2">
            <Textarea
              id="edit-notes"
              value={profile.notes}
              onChange={(event) => setProfile({ ...profile, notes: event.target.value })}
              className="min-h-24"
            />
          </Field>
        </TabsContent>
      </Tabs>
      <FormMessage result={save.error ? { ok: false, error: save.error.message } : null} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton pending={save.isPending} className="h-9">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

function DepartmentChecks({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { lookups } = useLookups();
  const copy = useLabels();
  if (lookups.departments.length === 0) {
    return <p className="text-sm text-muted-foreground">No {copy.departments.toLowerCase()} yet.</p>;
  }

  return (
    <Field label={copy.departments}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {lookups.departments.map((department) => {
          const checked = value.includes(department.id);
          return (
            <li key={department.id}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => {
                    onChange(next === true ? [...value, department.id] : value.filter((id) => id !== department.id));
                  }}
                />
                {department.name}
              </label>
            </li>
          );
        })}
      </ul>
    </Field>
  );
}
