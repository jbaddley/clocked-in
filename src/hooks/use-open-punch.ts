"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { openPunchQuery } from "@/lib/queries";

export function useOpenPunch() {
  const { viewer } = useWorkspace();
  const query = useQuery(openPunchQuery(viewer.id));
  return { ...query, punch: query.data ?? null };
}

export function useElapsed(startedAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return startedAt ? Math.max(0, now - new Date(startedAt).getTime()) : 0;
}
