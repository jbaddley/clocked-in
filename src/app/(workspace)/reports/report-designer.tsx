"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelRightCloseIcon, PanelRightOpenIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Field } from "@/components/field";
import { IconPickerDialog, iconLabel } from "@/components/icon-picker-dialog";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { SelectField, type Option } from "@/components/select-field";
import { StatsSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useMembers } from "@/hooks/use-members";
import { useOrganization } from "@/hooks/use-workspace";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { chartTypeLabel, chartTypes, paletteTypeLabel, paletteTypes } from "@/lib/chart-palette";
import { HttpError, sendJson } from "@/lib/fetch-json";
import { formatPatterns, formatPresetLabel } from "@/lib/number-pattern";
import { keys, reportQuery, savedReportQuery } from "@/lib/queries";
import {
  chartValueKeys,
  emptyLayout,
  firstOpening,
  layoutError,
  listColumnKeys,
  listColumnLabel,
  normalizeFilters,
  normalizeLayout,
  normalizeReportName,
  reportTemplate,
  reportTemplateIds,
  reportTemplateLabel,
  valueColors,
  valueFormats,
  type ReportCard,
  type ReportFilters,
  type ReportLayout,
  type ValueColor,
} from "@/lib/report-layout";
import { scalarAccessors, seriesAccessors } from "@/lib/report-path";
import { cn } from "cn";

const designerPreferencesKey = "clocked-in.report-designer";
const zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2];
const defaultDesignerPreferences = { editorOpen: true, zoom: 1 };
const presetIcons = ["clock", "hand-coins", "users", "list-checks"];

type DesignerPreferences = { editorOpen: boolean; zoom: number };

const preferenceListeners = new Set<() => void>();
let designerPreferences: DesignerPreferences = defaultDesignerPreferences;
let designerPreferencesLoaded = false;

const colorSwatches: Record<ValueColor, string> = {
  primary: "bg-primary",
  highlight: "bg-highlight",
  accent: "bg-brand-accent",
  success: "bg-success",
};

function readDesignerPreferences(): DesignerPreferences {
  try {
    const raw = window.localStorage.getItem(designerPreferencesKey);
    if (!raw) return defaultDesignerPreferences;
    const parsed = JSON.parse(raw) as Partial<DesignerPreferences>;
    return {
      editorOpen: parsed.editorOpen !== false,
      zoom: zoomSteps.find((step) => step === parsed.zoom) ?? 1,
    };
  } catch {
    return defaultDesignerPreferences;
  }
}

function loadDesignerPreferences() {
  if (!designerPreferencesLoaded) {
    designerPreferencesLoaded = true;
    designerPreferences = readDesignerPreferences();
  }
  return designerPreferences;
}

function subscribeDesignerPreferences(listener: () => void) {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

function updateDesignerPreferences(change: Partial<DesignerPreferences>) {
  designerPreferences = { ...loadDesignerPreferences(), ...change };
  window.localStorage.setItem(designerPreferencesKey, JSON.stringify(designerPreferences));
  preferenceListeners.forEach((listener) => listener());
}

function serverDesignerPreferences() {
  return defaultDesignerPreferences;
}

function useDesignerPreferences() {
  const preferences = useSyncExternalStore(subscribeDesignerPreferences, loadDesignerPreferences, serverDesignerPreferences);
  const setEditorOpen = useCallback((editorOpen: boolean) => updateDesignerPreferences({ editorOpen }), []);
  const setZoom = useCallback((zoom: number) => updateDesignerPreferences({ zoom }), []);
  return { editorOpen: preferences.editorOpen, zoom: preferences.zoom, setEditorOpen, setZoom };
}

function PreviewZoom({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
  const index = zoomSteps.indexOf(zoom);
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Preview zoom">
      <Button type="button" variant="outline" size="icon" aria-label="Zoom out" disabled={index <= 0} onClick={() => onZoom(zoomSteps[index - 1])}>
        <ZoomOutIcon />
      </Button>
      <Button type="button" variant="outline" className="w-16 tabular-nums" aria-label="Reset zoom" onClick={() => onZoom(1)}>
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Zoom in"
        disabled={index === -1 || index >= zoomSteps.length - 1}
        onClick={() => onZoom(zoomSteps[index + 1])}
      >
        <ZoomInIcon />
      </Button>
    </div>
  );
}

function personName(member: { user: { displayName: string | null; firstName: string | null; lastName: string | null; username: string } }) {
  const display = member.user.displayName?.trim();
  if (display) return display;
  const full = [member.user.firstName, member.user.lastName].filter(Boolean).join(" ").trim();
  return full || member.user.username;
}

function formatOptions(formats: readonly string[]) {
  return formats.map((value) => ({ value, label: formatPresetLabel(value as "number") }));
}

function iconOptions(current: string | null): Option[] {
  const options: Option[] = [{ value: "none", label: "None" }];
  for (const name of presetIcons) options.push({ value: name, label: iconLabel(name), icon: name });
  if (current && !presetIcons.includes(current)) options.push({ value: current, label: iconLabel(current), icon: current });
  options.push({ value: "other", label: "Other" });
  return options;
}

function DesignerForm({ initial }: { initial: SavedReport | null }) {
  const organization = useOrganization();
  const copy = useLabels();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lookups } = useLookups();
  const { members } = useMembers();
  const [name, setName] = useState(initial?.name ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [layout, setLayout] = useState<ReportLayout>(initial?.layout ?? emptyLayout());
  const [filters, setFilters] = useState<ReportFilters>(initial?.filters ?? {});
  const [filterDraft, setFilterDraft] = useState<ReportFilters>(initial?.filters ?? {});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.layout.cards[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const { editorOpen, zoom, setEditorOpen, setZoom } = useDesignerPreferences();
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const index = zoomSteps.indexOf(zoom);
      if (index === -1) return;
      const next = zoomSteps[index + (event.deltaY > 0 ? -1 : 1)];
      if (next) setZoom(next);
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [setZoom, zoom]);

  const preview = useQuery(reportQuery(organization.id, filters));
  const selected = layout.cards.find((card) => card.id === selectedId) ?? null;
  const filterCount = Object.keys(filters).length;

  const save = useMutation({
    mutationFn: async () => {
      let nextName: string;
      let nextLayout: ReportLayout;
      let nextFilters: ReportFilters;
      try {
        nextName = normalizeReportName(name);
        nextLayout = normalizeLayout(layout);
        nextFilters = normalizeFilters(filters);
      } catch (caught) {
        throw new HttpError(400, caught instanceof Error ? caught.message : "This report is not valid.");
      }

      const body = { name: nextName, isDefault, layout: nextLayout, filters: nextFilters };
      const path = initial
        ? `/organizations/${organization.id}/reports/${initial.id}`
        : `/organizations/${organization.id}/reports`;
      return sendJson<SavedReport>(path, initial ? "PATCH" : "POST", body);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: keys.savedReports(organization.id) });
      await queryClient.invalidateQueries({ queryKey: keys.savedReport(organization.id, saved.id) });
      router.push(saved.isDefault ? "/reports" : `/reports/${saved.id}`);
    },
    onError: (caught) => {
      setError(caught instanceof HttpError ? caught.message : "The report could not be saved.");
    },
  });

  function patch(id: string, change: Partial<ReportCard>) {
    setLayout((current) => ({
      version: 1,
      cards: current.cards.map((card) => (card.id === id ? ({ ...card, ...change } as ReportCard) : card)),
    }));
  }

  function addCard(kind: ReportCard["kind"]) {
    const columns = kind === "value" ? 3 : 6;
    const rows = kind === "value" ? 1 : kind === "list" ? 5 : 4;
    const spot = firstOpening(layout.cards, columns, rows);
    if (!spot) {
      setError("There is no open space for that card.");
      return;
    }

    const card: ReportCard =
      kind === "value"
        ? {
            id: crypto.randomUUID(),
            kind,
            title: "Value",
            description: "",
            accessor: "user.hours",
            color: "primary",
            format: "hours",
            pattern: formatPatterns.hours,
            icon: "clock",
            ...spot,
          }
        : kind === "list"
          ? {
              id: crypto.randomUUID(),
              kind,
              title: "List",
              description: "",
              accessor: "user.byProject",
              format: "hours",
              pattern: formatPatterns.hours,
              visibleColumns: ["name", "hours", "share", "inKind"],
              ...spot,
            }
          : {
              id: crypto.randomUUID(),
              kind,
              title: "Chart",
              description: "",
              accessor: "user.byDepartment",
              chartType: "column",
              palette: "single",
              valueKey: "hours",
              format: "hours",
              pattern: formatPatterns.hours,
              ...spot,
            };
    setError(null);
    setLayout((current) => ({ version: 1, cards: [...current.cards, card] }));
    setSelectedId(card.id);
    setEditorOpen(true);
  }

  function setDraftFilter(key: keyof ReportFilters, value: string) {
    setFilterDraft((current) => {
      const next = { ...current };
      if (!value || value === "any") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  const problem = layoutError(layout);
  const paths = selected?.kind === "value" ? scalarAccessors : seriesAccessors;
  const closeHref = initial ? (initial.isDefault ? "/reports" : `/reports/${initial.id}`) : "/reports";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <PageHeader
        className="shrink-0 sm:items-center [&>div:last-child]:min-w-0 [&>div:last-child]:flex-1"
        description="Drag a card to move it. Drag the top, right, bottom, or left edge to resize it."
        actions={
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
            <Input
              aria-label="Name"
              value={name}
              maxLength={80}
              placeholder="Report name"
              className="min-w-40 flex-1"
              onChange={(event) => setName(event.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
              Default report
            </label>
            <Link href={closeHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
              Cancel
            </Link>
            <Button type="button" size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => addCard("value")}>
          Value card
        </Button>
        <Button type="button" variant="outline" onClick={() => addCard("chart")}>
          Chart card
        </Button>
        <Button type="button" variant="outline" onClick={() => addCard("list")}>
          List card
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>Start from</DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {reportTemplateIds.map((id) => (
              <DropdownMenuItem
                key={id}
                onClick={() => {
                  const next = reportTemplate(id, copy);
                  setLayout(next);
                  setSelectedId(next.cards[0]?.id ?? null);
                  setError(null);
                }}
              >
                {reportTemplateLabel(id)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            setFilterDraft(filters);
            setFiltersOpen(true);
          }}
        >
          {filterCount > 0 ? `Edit filters (${filterCount})` : "Add filters"}
        </Button>
      </div>
      {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
      {problem ? <p className="shrink-0 text-sm text-destructive">{problem}</p> : null}
      <div className={cn("grid min-h-0 flex-1 gap-3", editorOpen && "grid-cols-[minmax(0,1fr)_18rem]")}>
        <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <h2 className="text-sm font-medium">Preview</h2>
            <div className="flex flex-wrap items-center gap-2">
              {preview.isFetching ? <p className="text-xs text-muted-foreground">Updating…</p> : null}
              <PreviewZoom zoom={zoom} onZoom={setZoom} />
            </div>
          </div>
          {!editorOpen ? (
            <Button type="button" variant="outline" className="absolute top-14 right-3 z-10" onClick={() => setEditorOpen(true)}>
              <PanelRightOpenIcon />
              Card editor
            </Button>
          ) : null}
          <div ref={previewRef} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3">
            {layout.cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a card, or start from a report template.</p>
            ) : null}
            <div style={{ width: `${zoom * 100}%` }}>
              <ReportGrid
                cards={layout.cards}
                data={preview.data}
                editing
                scale={zoom}
                scroll={false}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={(cards) => setLayout({ version: 1, cards })}
              />
            </div>
          </div>
        </section>
        {editorOpen ? (
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Card editor</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
                <PanelRightCloseIcon />
                Hide
              </Button>
            </div>
            {selected ? (
              <CardFields
                card={selected}
                paths={paths}
                onPatch={(change) => patch(selected.id, change)}
                onPickIcon={() => setIconPickerOpen(true)}
                onDelete={() => {
                  setLayout((current) => ({ version: 1, cards: current.cards.filter((card) => card.id !== selected.id) }));
                  setSelectedId(null);
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a card to edit its title, color, and data.</p>
            )}
          </aside>
        ) : null}
      </div>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{filterCount > 0 ? "Edit filters" : "Add filters"}</DialogTitle>
            <DialogDescription>These filters apply to the preview and are saved with the report.</DialogDescription>
          </DialogHeader>
          <DateRangeFilter
            range={{ from: filterDraft.from, to: filterDraft.to }}
            onChange={(range) =>
              setFilterDraft((current) => {
                const next = { ...current };
                if (range.from) next.from = range.from;
                else delete next.from;
                if (range.to) next.to = range.to;
                else delete next.to;
                return next;
              })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              aria-label={copy.department}
              value={filterDraft.departmentId ?? "any"}
              onValueChange={(value) => setDraftFilter("departmentId", value)}
              options={[{ value: "any", label: `Any ${copy.department.toLowerCase()}` }, ...lookups.departments.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <SelectField
              aria-label={copy.taskCategory}
              value={filterDraft.taskCategoryId ?? "any"}
              onValueChange={(value) => setDraftFilter("taskCategoryId", value)}
              options={[{ value: "any", label: `Any ${copy.taskCategory.toLowerCase()}` }, ...lookups.categories.map((item) => ({ value: item.id, label: item.name }))]}
            />
            <SelectField
              aria-label={copy.project}
              value={filterDraft.projectId ?? "any"}
              onValueChange={(value) => setDraftFilter("projectId", value)}
              options={[{ value: "any", label: `Any ${copy.project.toLowerCase()}` }, ...lookups.projects.map((item) => ({ value: item.id, label: item.title }))]}
            />
            <SelectField
              aria-label="Person"
              value={filterDraft.userId ?? "any"}
              onValueChange={(value) => setDraftFilter("userId", value)}
              options={[{ value: "any", label: "Any person" }, ...members.map((member) => ({ value: member.userId, label: personName(member) }))]}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFiltersOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setFilters(filterDraft);
                setFiltersOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <IconPickerDialog
        open={iconPickerOpen}
        onOpenChange={setIconPickerOpen}
        onSelect={(icon) => {
          if (selected?.kind === "value") patch(selected.id, { icon });
        }}
      />
    </div>
  );
}

function CardFields({
  card,
  paths,
  onPatch,
  onPickIcon,
  onDelete,
}: {
  card: ReportCard;
  paths: readonly (readonly [string, string])[];
  onPatch: (change: Partial<ReportCard>) => void;
  onPickIcon: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Field label="Title" htmlFor="card-title">
        <Input id="card-title" value={card.title} onChange={(event) => onPatch({ title: event.target.value })} />
      </Field>
      <Field label="Description" htmlFor="card-description">
        <Textarea id="card-description" value={card.description} onChange={(event) => onPatch({ description: event.target.value })} />
      </Field>
      <Field label="Data" htmlFor="card-accessor">
        <SelectField
          id="card-accessor"
          value={paths.some(([path]) => path === card.accessor) ? card.accessor : "custom"}
          onValueChange={(value) => {
            if (value !== "custom") onPatch({ accessor: value });
          }}
          options={[...paths.map(([value, label]) => ({ value, label })), { value: "custom", label: "Custom path" }]}
        />
        <Input aria-label="Data path" className="mt-2" value={card.accessor} onChange={(event) => onPatch({ accessor: event.target.value })} />
      </Field>
      <Field label="Format" htmlFor="card-format">
        <SelectField
          id="card-format"
          value={card.format}
          onValueChange={(format) => {
            if (format === "number" || format === "hours" || format === "currency") {
              onPatch({ format, pattern: formatPatterns[format] });
            }
          }}
          options={formatOptions(valueFormats)}
        />
      </Field>
      <Field label="Number format" htmlFor="card-pattern">
        <Input id="card-pattern" value={card.pattern ?? formatPatterns[card.format]} onChange={(event) => onPatch({ pattern: event.target.value })} />
      </Field>
      {card.kind === "value" ? (
        <>
          <Field label="Color" htmlFor="card-color">
            <SelectField
              id="card-color"
              value={card.color}
              onValueChange={(color) => onPatch({ color } as Partial<ReportCard>)}
              options={valueColors.map((value) => ({
                value,
                label: value.charAt(0).toUpperCase() + value.slice(1),
                swatch: colorSwatches[value],
              }))}
            />
          </Field>
          <Field label="Icon" htmlFor="card-icon">
            <SelectField
              id="card-icon"
              value={card.icon ?? "none"}
              onValueChange={(icon) => {
                if (icon === "other") {
                  onPickIcon();
                  return;
                }
                onPatch({ icon: icon === "none" ? null : icon });
              }}
              options={iconOptions(card.icon)}
            />
          </Field>
        </>
      ) : null}
      {card.kind === "chart" ? (
        <>
          <Field label="Chart type" htmlFor="card-chart">
            <SelectField
              id="card-chart"
              value={card.chartType}
              onValueChange={(chartType) => onPatch({ chartType } as Partial<ReportCard>)}
              options={chartTypes.map((value) => ({ value, label: chartTypeLabel(value) }))}
            />
          </Field>
          <Field label="Palette" htmlFor="card-palette">
            <SelectField
              id="card-palette"
              value={card.palette}
              onValueChange={(palette) => onPatch({ palette } as Partial<ReportCard>)}
              options={paletteTypes.map((value) => ({ value, label: paletteTypeLabel(value) }))}
            />
          </Field>
          <Field label="Value" htmlFor="card-value-key">
            <SelectField
              id="card-value-key"
              value={card.valueKey}
              onValueChange={(valueKey) => onPatch({ valueKey } as Partial<ReportCard>)}
              options={chartValueKeys.map((value) => ({ value, label: value === "inKind" ? "In-kind value" : "Hours" }))}
            />
          </Field>
        </>
      ) : null}
      {card.kind === "list" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Columns</legend>
          {listColumnKeys.map((column) => (
            <label key={column} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={card.visibleColumns.includes(column)}
                onCheckedChange={(checked) => {
                  const next = checked === true
                    ? [...card.visibleColumns, column]
                    : card.visibleColumns.filter((item) => item !== column);
                  onPatch({ visibleColumns: listColumnKeys.filter((item) => next.includes(item)) } as Partial<ReportCard>);
                }}
              />
              {listColumnLabel(column)}
            </label>
          ))}
        </fieldset>
      ) : null}
      <Button type="button" variant="destructive" onClick={onDelete}>
        Delete card
      </Button>
    </>
  );
}

export function ReportDesigner({ reportId }: { reportId?: string }) {
  const organization = useOrganization();
  const existing = useQuery({
    ...savedReportQuery(organization.id, reportId ?? ""),
    enabled: Boolean(reportId),
  });

  if (reportId && existing.isPending) return <StatsSkeleton />;
  if (reportId && (existing.isError || !existing.data)) {
    return <p className="text-sm text-muted-foreground">That report is not available.</p>;
  }

  return <DesignerForm key={existing.data?.id ?? "new"} initial={existing.data ?? null} />;
}
