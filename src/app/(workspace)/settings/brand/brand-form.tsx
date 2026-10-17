"use client";

import { useActionState } from "react";
import { removeOrganizationBrandAction, uploadOrganizationBrandAction } from "@/app/actions/organizations";
import { Field, FormMessage } from "@/components/field";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useOrganization } from "@/hooks/use-workspace";
import { brandAssetSrc, brandField, type BrandKind } from "@/lib/brand";

const accept = "image/png,image/jpeg,image/webp,image/gif";

const copy: Record<BrandKind, { title: string; description: string; preview: string }> = {
  mark: {
    title: "Favicon",
    description: "Square mark for the browser tab and the sidebar icon. Uploads are cropped to 64×64.",
    preview: "size-16 rounded-md object-contain",
  },
  wordmark: {
    title: "Logo",
    description: "Wide wordmark for the sidebar. Uploads are fit inside 800×200 without cropping.",
    preview: "h-10 max-w-56 object-contain",
  },
};

export function BrandForm() {
  return (
    <>
      <BrandAssetCard kind="mark" />
      <BrandAssetCard kind="wordmark" />
    </>
  );
}

function BrandAssetCard({ kind }: { kind: BrandKind }) {
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
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-foreground/10">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className={labels.preview} />
            ) : (
              <span className="px-2 text-center text-xs text-muted-foreground">No {labels.title.toLowerCase()}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">PNG, JPEG, WebP, or GIF. 4 MB or smaller.</p>
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
      </CardContent>
    </Card>
  );
}
