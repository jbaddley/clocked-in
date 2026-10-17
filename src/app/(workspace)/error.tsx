"use client";

import { Button } from "@/components/ui/button";

export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3 rounded-xl border bg-card p-6">
      <h1 className="text-xl font-semibold tracking-tight">This page could not load</h1>
      <p className="text-sm text-muted-foreground">{error.message || "Refresh and try again."}</p>
      <Button className="self-start" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
