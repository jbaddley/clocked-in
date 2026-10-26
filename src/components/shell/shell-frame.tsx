"use client";

import { usePathname } from "next/navigation";
import { cn } from "cn";

function isReportDesigner(pathname: string) {
  return pathname === "/reports/new" || /^\/reports\/[^/]+\/design$/.test(pathname);
}

export function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = isReportDesigner(pathname ?? "");

  return (
    <div
      className={cn(
        "mx-auto flex min-h-0 w-full flex-1 flex-col p-4 sm:p-6 lg:p-8",
        wide
          ? "overflow-hidden"
          : "max-w-7xl gap-6 overflow-y-auto overscroll-y-contain",
      )}
    >
      {children}
    </div>
  );
}
