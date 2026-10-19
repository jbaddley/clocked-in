import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NoOrganization } from "@/components/no-organization";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeletons";
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

  return (
    <>
      <PageHeader />
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <SettingsNav />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}
