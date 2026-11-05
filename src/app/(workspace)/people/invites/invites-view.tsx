"use client";

import { useWorkspace } from "@/hooks/use-workspace";
import { AccessRequestsCard, InviteForm } from "../invite-card";

export function InvitesView() {
  const { isAdmin } = useWorkspace();
  return (
    <div className="flex flex-col gap-6">
      <InviteForm />
      {isAdmin ? <AccessRequestsCard /> : null}
    </div>
  );
}
