import type { Metadata } from "next";
import { FeedbackView } from "./feedback-view";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return <FeedbackView />;
}
