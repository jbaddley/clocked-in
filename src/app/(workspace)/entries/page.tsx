import type { Metadata } from "next";
import { Suspense } from "react";
import { EntriesView } from "./entries-view";

export const metadata: Metadata = { title: "Entries" };

export default function EntriesPage() {
  return (
    <Suspense>
      <EntriesView />
    </Suspense>
  );
}
