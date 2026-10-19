import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NoOrganization } from "@/components/no-organization";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { getWorkspace } from "@/lib/server/dal";
import { SettingsNav } from "./settings-nav";
import { SettingsSection } from "./settings-section";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<PageSkeleton />}>
        <Settings>{children}</Settings>
      </Suspense>
    </div>
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

  return (
    <div data-settings-layout className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden">
      <PageHeader className="shrink-0" />
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden lg:grid-cols-[13rem_minmax(0,1fr)] lg:grid-rows-1">
        <SettingsNav />
        <SettingsSection>{children}</SettingsSection>
      </div>
    </div>
  );
}
