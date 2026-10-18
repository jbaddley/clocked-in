"use client";

import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { createOrganizationAction, switchOrganizationAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { brandAssetSrc } from "@/lib/brand";
import type { ActionResult, Organization } from "@/lib/types";

export function OrgSwitcher() {
  const { organizations, organization } = useWorkspace();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="h-9 max-w-56 justify-between gap-2 sm:max-w-72" disabled={pending} />
          }
        >
          <OrgLogo organization={organization} />
          <span className="truncate">{organization?.name ?? "No organization"}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            {organizations.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => {
                  if (item.id === organization?.id) return;
                  startTransition(async () => {
                    const result = await switchOrganizationAction(item.id);
                    if (!result.ok) toast.error(result.error);
                  });
                }}
              >
                <OrgLogo organization={item} fallback={false} />
                <span className="truncate">{item.name}</span>
                {item.id === organization?.id ? <CheckIcon className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <PlusIcon />
            New organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewOrganizationDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

export function NewOrganizationForm({ onDone }: { onDone?: () => void }) {
  const [result, action] = useActionState(async (previous: ActionResult | null, formData: FormData) => {
    const next = await createOrganizationAction(previous, formData);
    if (next.ok) {
      toast.success(next.message ?? "Organization created.");
      onDone?.();
    }
    return next;
  }, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Organization name" htmlFor="org-name">
        <Input id="org-name" name="name" required placeholder="Riverside Food Bank" className="h-9" autoFocus />
      </Field>
      {result && !result.ok ? <FormMessage result={result} /> : null}
      <SubmitButton className="h-9 self-start">Create organization</SubmitButton>
    </form>
  );
}

function OrgLogo({
  organization,
  fallback = true,
}: {
  organization: Pick<Organization, "markUrl"> | null;
  fallback?: boolean;
}) {
  const src = brandAssetSrc("mark", organization?.markUrl ?? null);
  if (!src) {
    return fallback ? <BuildingIcon className="text-muted-foreground" /> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={20} height={20} className="size-5 shrink-0 object-contain" />
  );
}

function NewOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>You will be its first admin. Switch between organizations any time.</DialogDescription>
        </DialogHeader>
        <NewOrganizationForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
