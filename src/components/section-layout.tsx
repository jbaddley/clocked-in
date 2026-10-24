import { PageHeader } from "@/components/page-header";
import { SectionPanel } from "@/components/section-panel";

export function SectionLayout({
  nav,
  children,
  footer,
  scrollKey,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollKey?: string;
}) {
  return (
    <div data-section-layout className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <PageHeader className="shrink-0" />
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden lg:grid-cols-[14rem_minmax(0,1fr)] lg:grid-rows-1">
        {nav}
        <SectionPanel footer={footer} scrollKey={scrollKey}>
          {children}
        </SectionPanel>
      </div>
    </div>
  );
}
