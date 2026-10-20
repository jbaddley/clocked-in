"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeletons";
import { meQuery } from "@/lib/queries";
import { ProfileForm } from "./profile-form";

export function ProfileView() {
  const { data, isPending } = useQuery(meQuery());
  if (isPending) return <PageSkeleton rows={8} />;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <PageHeader />
      {data?.profile ? <ProfileForm user={{ ...data, profile: data.profile }} /> : null}
    </div>
  );
}
