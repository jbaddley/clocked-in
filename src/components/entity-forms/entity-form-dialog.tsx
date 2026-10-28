"use client";

import { useState, type ReactNode } from "react";
import { cn } from "cn";
import { DialogActionsProvider, DialogActionsSlot } from "@/components/dialog-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function EntityFormDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const [session, setSession] = useState(0);
  const [seenOpen, setSeenOpen] = useState(open);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) setSession((value) => value + 1);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogActionsProvider>
        <DialogContent
          className={cn(
            "top-auto bottom-3 flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] translate-y-0 flex-col overflow-hidden overscroll-contain sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2",
            className,
          )}
        >
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div key={session} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
          <DialogActionsSlot />
        </DialogContent>
      </DialogActionsProvider>
    </Dialog>
  );
}
