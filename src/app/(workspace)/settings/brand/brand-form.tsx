"use client";

import { useActionState } from "react";
import { cn } from "cn";
import { removeOrganizationBrandAction, uploadOrganizationBrandAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOrganization } from "@/hooks/use-workspace";
import { brandAssetSrc, brandField, type BrandKind } from "@/lib/brand";

const accept = "image/png,image/jpeg,image/webp,image/gif";

const copy: Record<
  BrandKind,
  { title: string; description: string; preview: string; frame: string; empty: string }
> = {
  mark: {
    title: "Favicon",
    description: "Square mark for the browser tab and the sidebar icon. Uploads are cropped to 64×64.",
    preview: "size-16 rounded-md object-contain",
    frame: "size-20 shrink-0 bg-muted",
    empty: "No favicon",
  },
  wordmark: {
    title: "Light on dark",
    description: "Wordmark for the sidebar and other dark surfaces. Uploads are fit inside 800×200.",
    preview: "h-full w-full object-contain",
    frame: "h-20 min-w-32 flex-1 bg-sidebar",
    empty: "No light-on-dark logo",
  },
  wordmarkOnLight: {
    title: "Dark on light",
    description: "Wordmark for light pages. Uploads are fit inside 800×200.",
    preview: "h-full w-full object-contain",
    frame: "h-20 min-w-32 flex-1 bg-background",
    empty: "No dark-on-light logo",
  },
};

export function BrandForm() {
  return (
    <>
      <BrandAssetCard kind="mark" />
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Upload a light-on-dark wordmark for the sidebar and a dark-on-light wordmark for light backgrounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <BrandAssetFields kind="wordmark" />
          <BrandAssetFields kind="wordmarkOnLight" />
        </CardContent>
      </Card>
    </>
  );
}

function BrandAssetCard({ kind }: { kind: BrandKind }) {
  const labels = copy[kind];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <BrandAssetFields kind={kind} />
      </CardContent>
    </Card>
  );
}

function BrandAssetFields({ kind }: { kind: BrandKind }) {
  const organization = useOrganization();
  const storedUrl = organization[brandField(kind)];
  const src = brandAssetSrc(kind, storedUrl);
  const labels = copy[kind];
  const [uploadResult, uploadAction] = useActionState(
    uploadOrganizationBrandAction.bind(null, organization.id, kind),
    null,
  );
  const [removeResult, removeAction] = useActionState(
    removeOrganizationBrandAction.bind(null, organization.id, kind),
    null,
  );

  return (
    <div className="grid gap-4">
      {kind !== "mark" ? (
        <div>
          <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{labels.title}</p>
          <p className="mb-3 text-sm text-muted-foreground">{labels.description}</p>
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-lg ring-1 ring-foreground/10",
            labels.frame,
          )}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className={labels.preview} />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">{labels.empty}</span>
          )}
        </div>
        <p className="min-w-0 shrink text-sm text-muted-foreground">PNG, JPEG, WebP, or GIF. 4 MB or smaller.</p>
      </div>
      <form action={uploadAction} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Image" htmlFor={`${kind}-file`}>
            <Input id={`${kind}-file`} name="file" type="file" accept={accept} required className="h-9" />
          </Field>
          <SubmitButton className="h-9">Upload</SubmitButton>
        </div>
        <FormMessage result={uploadResult} />
      </form>
      {storedUrl ? (
        <form action={removeAction} className="flex items-center justify-between gap-3">
          <FormMessage result={removeResult} />
          <SubmitButton variant="destructive" className="ml-auto h-9">
            Remove
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
