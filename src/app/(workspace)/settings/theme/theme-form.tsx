"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MinusIcon, PlusIcon } from "lucide-react";
import { applyThemeAction, deleteThemeAction, saveThemeAction } from "@/app/actions/organizations";
import { Field } from "@/components/field";
import { SelectField } from "@/components/select-field";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useOrganization } from "@/hooks/use-workspace";
import { brandFontLabels, brandFonts, brandStyle, clockedInTheme } from "@/lib/brand";
import { keys, themesQuery } from "@/lib/queries";
import type { Theme } from "@/lib/types";

const colorFields = [
  { key: "primary", label: "Primary" },
  { key: "primaryForeground", label: "Primary text" },
  { key: "highlight", label: "Highlight" },
  { key: "accent", label: "Accent" },
  { key: "success", label: "Success" },
  { key: "surface", label: "Surface" },
  { key: "surfaceForeground", label: "Surface text" },
  { key: "foreground", label: "Foreground" },
] as const;

const fontOptions = brandFonts.map((font) => ({
  value: font,
  label: brandFontLabels[font],
}));

const hexColor = /^#[0-9A-Fa-f]{6}$/;

function cloneTheme(theme: Theme): Theme {
  return {
    ...theme,
    categoricalPalette: [...theme.categoricalPalette],
    sequentialPalette: [...theme.sequentialPalette],
    divergingPalette: [...theme.divergingPalette],
  };
}

function PaletteEditor({
  label,
  colors,
  min,
  max,
  onChange,
}: {
  label: string;
  colors: string[];
  min: number;
  max: number;
  onChange: (colors: string[]) => void;
}) {
  return (
    <Field label={label} hint={`${colors.length} colors · ${min} to ${max} required`}>
      <div className="grid gap-2">
        {colors.map((color, index) => (
          <div key={`${label}-${index}`} className="flex items-center gap-2">
            <input
              type="color"
              value={hexColor.test(color) ? color : "#000000"}
              onChange={(event) => {
                const next = [...colors];
                next[index] = event.target.value.toUpperCase();
                onChange(next);
              }}
              className="size-9 shrink-0 cursor-pointer rounded-md border bg-card p-1"
              aria-label={`${label} ${index + 1}`}
            />
            <Input
              value={color}
              onChange={(event) => {
                const next = [...colors];
                next[index] = event.target.value.toUpperCase();
                onChange(next);
              }}
              className="h-9 font-mono"
              aria-label={`${label} ${index + 1} hex`}
            />
            {colors.length > min ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => onChange(colors.filter((_, item) => item !== index))}
                aria-label={`Remove ${label} ${index + 1}`}
              >
                <MinusIcon />
              </Button>
            ) : null}
          </div>
        ))}
        {colors.length < max ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 w-fit"
            onClick={() => onChange([...colors, colors.at(-1) ?? "#001836"])}
          >
            <PlusIcon />
            Add color
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

export function ThemeForm() {
  const organization = useOrganization();
  return <ThemeFields key={`${organization.id}-${organization.themeId}`} />;
}

function ThemeFields() {
  const organization = useOrganization();
  const themes = useQuery(themesQuery(organization.id));
  const [draft, setDraft] = useState<Theme>(() => cloneTheme(organization.theme));
  const apply = useActionMutation((themeId: string) => applyThemeAction(organization.id, themeId));
  const save = useActionMutation(
    (next: Theme) =>
      saveThemeAction(organization.id, next.organizationId ? next.id : null, {
        name: next.name,
        primary: next.primary,
        primaryForeground: next.primaryForeground,
        highlight: next.highlight,
        accent: next.accent,
        success: next.success,
        surface: next.surface,
        surfaceForeground: next.surfaceForeground,
        foreground: next.foreground,
        headingFont: next.headingFont,
        bodyFont: next.bodyFont,
        categoricalPalette: next.categoricalPalette,
        sequentialPalette: next.sequentialPalette,
        divergingPalette: next.divergingPalette,
      }),
    {
      invalidate: [keys.themes(organization.id)],
      onSuccess: (theme) => {
        if (theme) {
          setDraft(cloneTheme(theme));
        }
      },
    },
  );
  const remove = useActionMutation((themeId: string) => deleteThemeAction(organization.id, themeId));
  const catalog = themes.data ?? [organization.theme];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardHeader>
          <CardTitle>Themes</CardTitle>
          <CardDescription>
            Choose a global theme to fill the colors, then save a named theme for this organization. Chart palettes stay
            with the theme.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(draft);
            }}
          >
            <Field label="Apply theme">
              <SelectField
                value={organization.themeId}
                onValueChange={(themeId) => {
                  const selected = catalog.find((theme) => theme.id === themeId);
                  if (selected) {
                    setDraft(cloneTheme(selected));
                  }

                  apply.mutate(themeId);
                }}
                options={catalog.map((theme) => ({
                  value: theme.id,
                  label: theme.organizationId ? theme.name : `${theme.name} (global)`,
                }))}
                className="h-9"
              />
            </Field>
            <Field label="Theme name" htmlFor="themeName">
              <Input
                id="themeName"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="h-9"
              />
            </Field>
            {colorFields.map((field) => {
              const value = String(draft[field.key]);
              return (
                <Field key={field.key} label={field.label} htmlFor={field.key}>
                  <div className="flex items-center gap-2">
                    <input
                      id={field.key}
                      type="color"
                      value={hexColor.test(value) ? value : "#000000"}
                      onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value.toUpperCase() })}
                      className="size-9 shrink-0 cursor-pointer rounded-md border bg-card p-1"
                    />
                    <Input
                      value={value}
                      onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value.toUpperCase() })}
                      className="h-9 font-mono"
                    />
                  </div>
                </Field>
              );
            })}
            <Field label="Heading font">
              <SelectField
                value={draft.headingFont}
                onValueChange={(headingFont) => setDraft({ ...draft, headingFont })}
                options={fontOptions}
                className="h-9"
              />
            </Field>
            <Field label="Body font">
              <SelectField
                value={draft.bodyFont}
                onValueChange={(bodyFont) => setDraft({ ...draft, bodyFont })}
                options={fontOptions}
                className="h-9"
              />
            </Field>
            <div className="sm:col-span-2 grid gap-4">
              <PaletteEditor
                label="Categorical chart palette"
                colors={draft.categoricalPalette}
                min={6}
                max={8}
                onChange={(categoricalPalette) => setDraft({ ...draft, categoricalPalette })}
              />
              <PaletteEditor
                label="Sequential chart palette"
                colors={draft.sequentialPalette}
                min={5}
                max={7}
                onChange={(sequentialPalette) => setDraft({ ...draft, sequentialPalette })}
              />
              <PaletteEditor
                label="Diverging chart palette"
                colors={draft.divergingPalette}
                min={7}
                max={7}
                onChange={(divergingPalette) => setDraft({ ...draft, divergingPalette })}
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <SubmitButton pending={save.isPending} className="h-9">
                Save theme
              </SubmitButton>
              {draft.organizationId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(draft.id)}
                >
                  Delete theme
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-9"
                disabled={apply.isPending}
                onClick={() => {
                  const def = catalog.find((theme) => theme.id === clockedInTheme.id) ?? clockedInTheme;
                  setDraft(cloneTheme(def));
                  apply.mutate(def.id);
                }}
              >
                Reset to default
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit overflow-hidden py-0" style={brandStyle(draft)}>
        <div className="bg-sidebar px-4 py-5 text-sidebar-foreground">
          <p className="text-xs tracking-widest uppercase opacity-70">Preview</p>
          <p className="mt-1 font-heading text-lg font-semibold">{organization.name}</p>
        </div>
        <div className="brand-rule" />
        <CardContent className="bg-card py-4 text-card-foreground">
          <p className="text-sm text-muted-foreground">Volunteer hours</p>
          <p className="text-2xl font-heading font-semibold text-highlight">12.5 h</p>
          <div className="mt-3 grid gap-2">
            {[draft.categoricalPalette, draft.sequentialPalette, draft.divergingPalette].map((palette, index) => (
              <div key={["categorical", "sequential", "diverging"][index]} className="flex gap-1">
                {palette.map((color, colorIndex) => (
                  <span key={`${color}-${colorIndex}`} className="h-6 flex-1 rounded-sm" style={{ background: color }} />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
