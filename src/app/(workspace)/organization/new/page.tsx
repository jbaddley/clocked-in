import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeletons";
import { requirePinnedOrganizationOrApex } from "@/lib/server/tenant";
import { NewOrganizationView } from "./new-organization-view";

export const metadata: Metadata = { title: "New organization" };

export default function NewOrganizationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewOrganizationContent />
    </Suspense>
  );
}

async function NewOrganizationContent() {
  const pinned = await requirePinnedOrganizationOrApex();
  if (pinned.pinned) {
    redirect("/dashboard");
  }

  return <NewOrganizationView />;
}
