"use client";

import { useParams } from "next/navigation";
import { FeedbackDetail } from "./[id]/feedback-detail";
import { FeedbackView } from "./feedback-view";

export function FeedbackRouteFrame({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === "string" ? params.id : null;
  return (
    <>
      {id ? <FeedbackDetail id={id} /> : <FeedbackView />}
      {children}
    </>
  );
}
