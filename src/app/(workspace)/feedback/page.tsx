import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Hydrate } from "@/components/hydrate";
import { PageSkeleton } from "@/components/skeletons";
import { getQueryClient } from "@/lib/query-client";
import { feedbackQuery } from "@/lib/queries";
import { getWorkspace } from "@/lib/server/dal";
import { FeedbackView } from "./feedback-view";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <FeedbackInbox />
    </Suspense>
  );
}

async function FeedbackInbox() {
  const { viewer } = await getWorkspace();
  if (!viewer.isSuperAdmin) {
    redirect("/dashboard");
  }

  const queryClient = getQueryClient();
  await Promise.all([queryClient.prefetchQuery(feedbackQuery(true)), queryClient.prefetchQuery(feedbackQuery(false))]);
  return (
    <Hydrate client={queryClient}>
      <FeedbackView />
    </Hydrate>
  );
}
