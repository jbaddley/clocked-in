"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className='mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center'>
      <p className='text-xs font-semibold tracking-widest uppercase'>VolunTime</p>
      <h1 className='text-2xl font-semibold tracking-tight'>Something went wrong</h1>
      <p className='text-sm text-muted-foreground'>{error.message || "Try again in a moment."}</p>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
