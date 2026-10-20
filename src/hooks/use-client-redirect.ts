"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useClientRedirect(when: boolean, href: string) {
  const router = useRouter();
  useEffect(() => {
    if (when) router.replace(href);
  }, [when, href, router]);
}
