"use client";

import { BuildingIcon, CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { switchOrganizationAction } from "@/app/actions/organizations";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/hooks/use-workspace";
import { brandAssetSrc } from "@/lib/brand";
import type { Organization } from "@/lib/types";

export function OrgSwitcher() {
  const { organizations, organization } = useWorkspace();
  const [pending, startTransition] = useTransition();

  return (
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
        <DropdownMenuItem render={<Link href="/organization/new" />}>
          <PlusIcon />
          New organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
