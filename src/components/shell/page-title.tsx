"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/hooks/use-workspace";
import { viewTitle } from "@/lib/view-title";

export function HeaderTitle() {
  const pathname = usePathname();
  const { viewer } = useWorkspace();
  const title = viewTitle(pathname, viewer.name);
  if (!title) return null;

  return (
    <h1 className="ml-3 hidden min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight lg:block">{title}</h1>
  );
}
