"use client";

import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useWorkspace } from "@/hooks/use-workspace";
import { viewTitle } from "@/lib/view-title";

export function PageHeader({
  description,
  actions,
  className,
}: {
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const { viewer, organization } = useWorkspace();
  const title = viewTitle(pathname ?? "", viewer.name, organization?.name);
  const hasSupport = Boolean(description || actions);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        !hasSupport && "lg:hidden",
        className,
      )}
    >
      <div className={cn("min-w-0", !description && "lg:hidden")}>
        <h1 className="truncate text-2xl font-semibold tracking-tight lg:hidden">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground lg:mt-0">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
