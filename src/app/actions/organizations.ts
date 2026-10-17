"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import {
  createOrganization,
  parseName,
  parseUpdateOrganization,
  updateOrganization,
  type OrganizationPreferences,
} from "@/lib/api/features/organizations";
import { createTheme, deleteTheme, updateTheme, type ThemeWriteRequest } from "@/lib/api/features/themes";
import { forbidden } from "@/lib/api/errors";
import { run, text } from "@/lib/server/action";
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
