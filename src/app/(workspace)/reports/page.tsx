import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";
import { ReportsHome } from "./reports-home";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const workspace = await getWorkspace();
  if (!canSeeReports(workspace)) {
    redirect("/dashboard");
  }

  return (
    <Suspense>
      <ReportsHome />
    </Suspense>
  );
}
