"use client";

import { MessageSquarePlusIcon } from "lucide-react";
import { useState } from "react";
import { FeedbackDialog } from "@/components/entity-forms/feedback-form";
import { Button } from "@/components/ui/button";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" className="h-9 gap-2" onClick={() => setOpen(true)}>
        <MessageSquarePlusIcon className="text-primary" />
        <span className="hidden sm:inline">Feedback</span>
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
