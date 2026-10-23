import type { Metadata } from "next";
import { FeedbackDetail } from "./feedback-detail";

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FeedbackDetail id={id} />;
}
