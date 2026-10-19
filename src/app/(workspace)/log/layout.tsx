import { Suspense } from "react";
import { NoOrganization } from "@/components/no-organization";
import { PageSkeleton } from "@/components/skeletons";
import { SectionLayout } from "@/components/section-layout";
import { getWorkspace } from "@/lib/server/dal";
import { LogNav } from "./log-nav";

export default function LogLayout({ children }: LayoutProps<"/log">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Log>{children}</Log>
    </Suspense>
  );
}

async function Log({ children }: { children: React.ReactNode }) {
  const { organization } = await getWorkspace();
  if (!organization) {
    return <NoOrganization />;
  }

  return <SectionLayout nav={<LogNav />}>{children}</SectionLayout>;
}
