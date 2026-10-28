import { redirect } from "next/navigation";
import { canSeeReports } from "@/lib/roles";
import { getWorkspace } from "@/lib/server/dal";

export async function ReportAccess({ admin = false, children }: { admin?: boolean; children: React.ReactNode }) {
  const workspace = await getWorkspace();
  if (!canSeeReports(workspace)) redirect("/dashboard");
  if (admin && !workspace.isAdmin && !workspace.permissions.includes("design_reports")) redirect("/reports");
  return children;
}
