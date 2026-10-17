import { dehydrate, HydrationBoundary, type QueryClient } from "@tanstack/react-query";

export function Hydrate({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>;
}
