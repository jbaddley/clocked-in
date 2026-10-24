"use client";

import { useQuery } from "@tanstack/react-query";
import { PageSkeleton } from "@/components/skeletons";
import { meQuery } from "@/lib/queries";
import { ProfileForm } from "./profile-form";

export function ProfileView() {
  const { data, isPending } = useQuery(meQuery());
  if (isPending) return <PageSkeleton rows={8} />;
  if (!data?.profile) return null;

  return <ProfileForm user={{ ...data, profile: data.profile }} />;
}
