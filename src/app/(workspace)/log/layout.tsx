import { SectionLayout } from "@/components/section-layout";
import { LogNav } from "./log-nav";

export default function LogLayout({ children }: LayoutProps<"/log">) {
  return <SectionLayout nav={<LogNav />}>{children}</SectionLayout>;
}
