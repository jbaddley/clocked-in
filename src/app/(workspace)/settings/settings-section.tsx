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
    <div ref={scroller} className="min-h-0 min-w-0 overflow-y-auto overscroll-y-contain">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
