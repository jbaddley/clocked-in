"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function SectionPanel({
  children,
  footer,
  scrollKey,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollKey?: string;
}) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [pathname, scrollKey]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <div ref={scroller} className="min-h-0 shrink overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
        <div className="flex flex-col gap-6 py-0.5 ps-0.5 pe-4">{children}</div>
      </div>
      {footer ? <div className="shrink-0 ps-0.5 pe-4 pt-4 pb-0.5">{footer}</div> : null}
    </div>
  );
}
