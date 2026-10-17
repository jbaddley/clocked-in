"use client";

import { PencilIcon, PlusIcon, Trash2Icon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { deleteLookupAction, type NamedLookupKind } from "@/app/actions/lookups";
import { NamedEntityDialog } from "@/components/entity-forms/name-entity-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useOrganization } from "@/hooks/use-workspace";
import { keys } from "@/lib/queries";

type Item = { id: string; name?: string; title?: string };

export function LookupListCard({
  kind,
  title,
  description,
  items,
  icon: Icon,
}: {
  kind: NamedLookupKind;
  title: string;
  description: string;
  items: Item[];
  icon: LucideIcon;
}) {
  const organization = useOrganization();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);
  const remove = useActionMutation((id: string) => deleteLookupAction(kind, id), {
    invalidate: [keys.lookups(organization.id)],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button type="button" size="sm" className="h-8" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.length ? (
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{item.name ?? item.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${item.name ?? item.title}`}
                  onClick={() => setEditing(item)}
                >
                  <PencilIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${item.name ?? item.title}`}
                  onClick={() => setPendingDelete(item)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Icon} title={`No ${title.toLowerCase()} yet`} className="py-8" />
        )}
      </CardContent>
      <NamedEntityDialog kind={kind} open={creating} onOpenChange={setCreating} />
      <NamedEntityDialog
        kind={kind}
        entity={editing ? { id: editing.id, name: editing.name ?? editing.title ?? "" } : null}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? pendingDelete?.title ?? "this item"}?`}
        description="Time already logged against it stays, but you will not be able to pick it for new entries."
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </Card>
  );
}
