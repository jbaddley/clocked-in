"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export function SettingsSection({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div ref={scroller} className="min-h-0 min-w-0 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
      <div className="flex flex-col gap-6 py-0.5 ps-0.5 pe-4">{children}</div>
    </div>
  );
}
