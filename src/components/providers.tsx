"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lookupPersister, persistedLookupQuery } from "@/lib/lookup-persistence";
import { getQueryClient } from "@/lib/query-client";
import { lookupGcTime } from "@/lib/queries";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={getQueryClient()}
      persistOptions={{
        persister: lookupPersister,
        maxAge: lookupGcTime,
        dehydrateOptions: { shouldDehydrateQuery: persistedLookupQuery },
      }}
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="top-right" richColors closeButton />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </PersistQueryClientProvider>
  );
}
