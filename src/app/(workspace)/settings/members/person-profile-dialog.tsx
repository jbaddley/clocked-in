"use client";

import { useQuery } from "@tanstack/react-query";
import { MarkdownView } from "@/components/markdown-view";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/fetch-json";
import { formatInstant } from "@/lib/format";
import { safeHttpUrl } from "@/lib/url";
import type { Membership } from "@/lib/types";

type UserProfile = {
  firstName: string;
  lastName: string;
  displayName: string | null;
  timezone: string;
  phone: string | null;
  zipCode: string | null;
  notes: string | null;
  memberNumber: string | null;
  avatarUrl: string | null;
  description: string | null;
};

type UserResponse = {
  id: string;
  username: string;
  email: string;
  profile: UserProfile | null;
};

function personName(member: Membership, profile: UserProfile | null | undefined) {
  const display = profile?.displayName?.trim() || member.user.displayName?.trim();
  if (display) return display;
  const full = [profile?.firstName ?? member.user.firstName, profile?.lastName ?? member.user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return full || member.user.username;
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm break-words">{value}</dd>
    </div>
  );
}

export function PersonProfileDialog({
  member,
  departmentNames,
  timeZone,
  onOpenChange,
}: {
  member: Membership | null;
  departmentNames: string[];
  timeZone: string;
  onOpenChange: (open: boolean) => void;
}) {
  const profileQuery = useQuery({
    queryKey: ["user", member?.userId],
    enabled: Boolean(member),
    queryFn: ({ signal }) => fetchJson<UserResponse>(`/users/${member!.userId}`, signal),
  });
  const profile = profileQuery.data?.profile;
  const name = member ? personName(member, profile) : "";
  const avatarSrc = safeHttpUrl(profile?.avatarUrl);

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(40rem,85vh)] overflow-y-auto sm:max-w-lg">
        {member ? (
          <>
            <DialogHeader className="pr-8">
              <div className="flex items-center gap-3">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <DialogTitle className="truncate text-lg">{name}</DialogTitle>
                  <DialogDescription className="truncate">
                    {member.orgUserTitle?.trim() || member.user.email}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {profileQuery.isPending ? <p className="text-sm text-muted-foreground">Loading profile…</p> : null}
            {profileQuery.isError ? (
              <p className="text-sm text-muted-foreground">The rest of this profile is not available.</p>
            ) : null}

            {profile?.description?.trim() ? (
              <section>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">About</h3>
                <div className="mt-2">
                  <MarkdownView source={profile.description} />
                </div>
              </section>
            ) : null}

            {member.orgUserDescription?.trim() ? (
              <section>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">In this organization</h3>
                <div className="mt-2">
                  <MarkdownView source={member.orgUserDescription} />
                </div>
              </section>
            ) : null}

            <dl className="grid gap-4 sm:grid-cols-2">
              <Fact label="Username" value={member.user.username} />
              <Fact label="Email" value={profileQuery.data?.email ?? member.user.email} />
              <Fact label="First name" value={profile?.firstName ?? member.user.firstName} />
              <Fact label="Last name" value={profile?.lastName ?? member.user.lastName} />
              <Fact label="Display name" value={profile?.displayName ?? member.user.displayName} />
              <Fact label="Title" value={member.orgUserTitle} />
              <Fact label="Role" value={member.role.name} />
              <Fact label="Status" value={member.isActive === false ? "Inactive" : "Active"} />
              <Fact label="Departments" value={departmentNames.join(", ")} />
              <Fact label="Member number" value={profile?.memberNumber} />
              <Fact label="Timezone" value={profile?.timezone} />
              <Fact label="Phone" value={profile?.phone} />
              <Fact label="Zip code" value={profile?.zipCode} />
              <Fact label="Joined" value={formatInstant(member.joinedAt, profile?.timezone || timeZone)} />
              <Fact label="Notes" value={profile?.notes} />
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
