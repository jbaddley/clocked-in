"use client";

import { usePathname } from "next/navigation";
import { ReportSwitcher } from "@/app/(workspace)/reports/report-switcher";
import { useWorkspace } from "@/hooks/use-workspace";
import { isReportViewerPath } from "@/lib/report-slug";
import { viewTitle } from "@/lib/view-title";

export function HeaderTitle() {
  const pathname = usePathname();
  const { viewer, organization } = useWorkspace();
  const title = viewTitle(pathname ?? "", viewer.name, organization?.name);
  if (!title) return null;

  if (isReportViewerPath(pathname ?? "")) {
    return (
      <div className="ml-3 hidden min-w-0 flex-1 items-center gap-1 lg:flex">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        <ReportSwitcher />
      </div>
    );
  }

  return (
    <h1 className="ml-3 hidden min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight lg:block">{title}</h1>
  );
}
