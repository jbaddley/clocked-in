"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import {
  createOrganization,
  getOrganization,
  parseName,
  parseUpdateOrganization,
  updateOrganization,
  type OrganizationPreferences,
} from "@/lib/api/features/organizations";
import { createTheme, deleteTheme, updateTheme, type ThemeWriteRequest } from "@/lib/api/features/themes";
import { forbidden, validation } from "@/lib/api/errors";
import { brandField, isBrandKind, isVercelBlobUrl, type BrandKind } from "@/lib/brand";
import { run, text } from "@/lib/server/action";
import { deleteBrandAsset, putBrandAsset, resizeBrandImage, storedBrandUrl } from "@/lib/server/brand-assets";
import { getOrganizations } from "@/lib/server/dal";
import { requireAccess } from "@/lib/server/session";
import { writeOrganization } from "@/lib/server/session-cookies";
import type { ActionResult } from "@/lib/types";

export async function switchOrganizationAction(organizationId: string) {
  return run(async () => {
    const organizations = await getOrganizations();
    if (!organizations.some((item) => item.id === organizationId)) {
      forbidden();
    }

    writeOrganization(await cookies(), organizationId);
    refresh();
  });
}

export async function createOrganizationAction(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    const created = await createOrganization(access, parseName({ name: text(formData, "name") }));
    writeOrganization(await cookies(), created.id);
    refresh();
  }, "Organization created.");
}

export async function updateOrganizationSettingsAction(
  organizationId: string,
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    const preferences: OrganizationPreferences = {
      allowTimeEntryEditing: formData.get("allowTimeEntryEditing") === "on",
      entityLabels: {
        organization: text(formData, "labelOrganization"),
        project: text(formData, "labelProject"),
        department: text(formData, "labelDepartment"),
        taskCategory: text(formData, "labelTaskCategory"),
      },
    };
    await updateOrganization(
      access,
      organizationId,
      parseUpdateOrganization({
        name: text(formData, "name"),
        rateSourceYear: Number(text(formData, "rateSourceYear")),
        preferences,
      }),
    );
    refresh();
  }, "Organization saved.");
}

export async function applyThemeAction(organizationId: string, themeId: string) {
  return run(async () => {
    const access = await requireAccess();
    await updateOrganization(access, organizationId, parseUpdateOrganization({ themeId }));
    refresh();
  }, "Theme applied.");
}

export async function saveThemeAction(organizationId: string, themeId: string | null, request: ThemeWriteRequest) {
  return run(async () => {
    const access = await requireAccess();
    const theme = themeId
      ? await updateTheme(access, organizationId, themeId, request)
      : await createTheme(access, organizationId, request);
    await updateOrganization(access, organizationId, parseUpdateOrganization({ themeId: theme.id }));
    refresh();
    return theme;
  }, "Theme saved.");
}

export async function deleteThemeAction(organizationId: string, themeId: string) {
  return run(async () => {
    const access = await requireAccess();
    await deleteTheme(access, organizationId, themeId);
    refresh();
  }, "Theme deleted.");
}

function requireBrandKind(kind: string): BrandKind {
  if (!isBrandKind(kind)) {
    validation("kind must be mark, wordmark, or wordmarkOnLight.");
  }

  return kind;
}

export async function uploadOrganizationBrandAction(
  organizationId: string,
  kind: BrandKind,
  _: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    const asset = requireBrandKind(kind);
    const organization = await getOrganization(access, organizationId);
    const file = formData.get("file");
    if (!(file instanceof File)) {
      validation("Choose an image to upload.");
    }

    const buffer = await resizeBrandImage(file, asset);
    const blob = await putBrandAsset(organizationId, asset, buffer);
    const previous = storedBrandUrl(organization, asset);
    await updateOrganization(
      access,
      organizationId,
      parseUpdateOrganization({ [brandField(asset)]: blob.url }),
    );
    if (previous && isVercelBlobUrl(previous) && previous !== blob.url) {
      await deleteBrandAsset(previous);
    }

    refresh();
  }, `${assetLabel(kind)} saved.`);
}

export async function removeOrganizationBrandAction(
  organizationId: string,
  kind: BrandKind,
  _: ActionResult | null,
  _formData?: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const access = await requireAccess();
    const asset = requireBrandKind(kind);
    const organization = await getOrganization(access, organizationId);
    const previous = storedBrandUrl(organization, asset);
    await updateOrganization(access, organizationId, parseUpdateOrganization({ [brandField(asset)]: null }));
    await deleteBrandAsset(previous);
    refresh();
  }, `${assetLabel(kind)} removed.`);
}

function assetLabel(kind: BrandKind) {
  if (kind === "mark") {
    return "Favicon";
  }

  return kind === "wordmark" ? "Light on dark logo" : "Dark on light logo";
}
