"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { safeHttpUrl } from "@/lib/url";
import { changePasswordAction, updateProfileAction } from "@/app/actions/profile";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const selectClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

function timezoneChoices(current: string) {
  const rest = Intl.supportedValuesOf("timeZone")
    .filter((zone) => zone !== "UTC" && zone !== current)
    .sort((a, b) => a.localeCompare(b));
  return current === "UTC" ? ["UTC", ...rest] : [current, "UTC", ...rest];
}

export type EditableProfile = {
  username: string;
  email: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string | null;
    timezone: string;
    phone: string | null;
    zipCode: string | null;
    notes: string | null;
    avatarUrl: string | null;
    description: string | null;
  };
};

export function ProfileForm({ user }: { user: EditableProfile }) {
  const [result, action] = useActionState(updateProfileAction, null);
  const profile = user.profile;
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const avatarSrc = safeHttpUrl(avatarUrl);
  const [zones, setZones] = useState<string[]>(() => [profile.timezone || "UTC"]);

  useEffect(() => {
    setZones(timezoneChoices(profile.timezone || "UTC"));
  }, [profile.timezone]);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>Reports use your display name when it is set, then your first and last name.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="firstName">
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={100}
              defaultValue={profile.firstName}
              className="h-9"
            />
          </Field>
          <Field label="Last name" htmlFor="lastName">
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={100}
              defaultValue={profile.lastName}
              className="h-9"
            />
          </Field>
          <Field label="Avatar URL" htmlFor="avatarUrl" hint="A link to an image. Leave blank to remove it." className="sm:col-span-2">
            <div className="flex items-center gap-3">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="size-12 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  None
                </span>
              )}
              <Input
                id="avatarUrl"
                name="avatarUrl"
                type="url"
                inputMode="url"
                maxLength={2000}
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
                placeholder="https://"
                className="h-9"
              />
            </div>
          </Field>
          <Field label="Description" htmlFor="description" hint="Markdown. Shown on your profile." className="sm:col-span-2">
            <Textarea
              id="description"
              name="description"
              maxLength={8000}
              defaultValue={profile.description ?? ""}
              className="min-h-32"
            />
          </Field>
          <Field label="Display name" htmlFor="displayName" hint="Leave blank to use your first and last name." className="sm:col-span-2">
            <Input
              id="displayName"
              name="displayName"
              autoComplete="nickname"
              maxLength={100}
              defaultValue={profile.displayName ?? ""}
              className="h-9"
            />
          </Field>
          <Field label="Timezone" htmlFor="timezone" hint="Punch dates use this timezone.">
            <select id="timezone" name="timezone" required defaultValue={profile.timezone} className={selectClass}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              defaultValue={profile.phone ?? ""}
              className="h-9"
            />
          </Field>
          <Field label="Zip code" htmlFor="zipCode" hint="Shown on volunteer workbooks.">
            <Input
              id="zipCode"
              name="zipCode"
              autoComplete="postal-code"
              maxLength={20}
              defaultValue={profile.zipCode ?? ""}
              className="h-9"
            />
          </Field>
          <Field label="Notes" htmlFor="notes" hint="Visible to you and organization admins." className="sm:col-span-2">
            <Textarea id="notes" name="notes" maxLength={2000} defaultValue={profile.notes ?? ""} className="min-h-24" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign-in</CardTitle>
          <CardDescription>Username is how you sign in. Invite and password codes go to this email.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" htmlFor="username" hint="Letters, numbers, dots, underscores, or hyphens.">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={50}
              defaultValue={user.username}
              className="h-9"
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              defaultValue={user.email}
              className="h-9"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FormMessage result={result} />
        <SubmitButton className="h-9 sm:ml-auto">Save profile</SubmitButton>
      </div>
      </form>
      <PasswordForm />
    </div>
  );
}

function PasswordForm() {
  const [result, submit, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result?.ok) formRef.current?.reset();
  }, [result]);

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => {
          submit(data);
        });
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>A new password signs out every other device. This browser stays signed in.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Current password" htmlFor="currentPassword" className="sm:col-span-2">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              className="h-9"
            />
          </Field>
          <Field label="New password" htmlFor="password" hint="8 characters or more.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-9" />
          </Field>
          <Field label="Confirm new password" htmlFor="confirmPassword">
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="h-9"
            />
          </Field>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FormMessage result={result} />
        <SubmitButton pending={pending} className="h-9 sm:ml-auto">
          Update password
        </SubmitButton>
      </div>
    </form>
  );
}
