import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NoOrganization } from "@/components/no-organization";
import { PageSkeleton } from "@/components/skeletons";
import { SectionLayout } from "@/components/section-layout";
import { getWorkspace } from "@/lib/server/dal";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings>{children}</Settings>
    </Suspense>
  );
}

async function Settings({ children }: { children: React.ReactNode }) {
  const { organization, isAdmin } = await getWorkspace();
  if (!organization) {
    return <NoOrganization />;
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return <SectionLayout nav={<SettingsNav />}>{children}</SectionLayout>;
}
