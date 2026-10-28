"use server";

import {
  createAccessRequest,
  decideAccessRequest,
  parseCreateAccessRequest,
} from "@/lib/api/features/access-requests";
import { body, run } from "@/lib/server/action";
import { requireAccess } from "@/lib/server/session";

export async function requestAccessAction(
  organizationId: string,
  input: { message?: string; requestedRole?: string; requestedDepartmentIds?: string[] },
) {
  return run(async () => {
    const access = await requireAccess();
    return createAccessRequest(access, organizationId, parseCreateAccessRequest(body(input)));
  }, "Access request sent.");
}

export async function decideAccessRequestAction(
  organizationId: string,
  requestId: string,
  status: "approved" | "declined",
) {
  return run(async () => {
    const access = await requireAccess();
    return decideAccessRequest(access, organizationId, requestId, status);
  }, status === "approved" ? "Request approved." : "Request declined.");
}
