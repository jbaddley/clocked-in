import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { getUser } from "@/lib/api/features/users";
import { requireAccess } from "@/lib/server/session";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const access = await requireAccess();
  const user = await getUser(access, access.caller.id);
  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <PageHeader />
      {user.profile ? <ProfileForm user={{ ...user, profile: user.profile }} /> : null}
    </div>
  );
}
