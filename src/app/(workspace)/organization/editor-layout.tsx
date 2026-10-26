"use client";

import { PageHeader } from "@/components/page-header";
import { SectionPanel } from "@/components/section-panel";

export function EditorLayout({ footer, children }: { footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <PageHeader className="shrink-0" />
      <SectionPanel footer={footer}>{children}</SectionPanel>
    </div>
  );
}
