"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChartColumnIcon, CircleHelpIcon, HashIcon, ListIcon, XIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Field } from "@/components/field";
import { IconPickerDialog, iconLabel } from "@/components/icon-picker-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import type { ReportTemplate } from "@/lib/api/features/report-templates";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { chartTypeLabel, chartTypes, paletteTypeLabel, paletteTypes } from "@/lib/chart-palette";
import {
  createReportAction,
  createReportTemplateAction,
  updateReportAction,
  updateReportTemplateAction,
} from "@/app/actions/reports";
import { formatPatterns, formatPresetLabel } from "@/lib/number-pattern";
import { keys, reportQuery, reportTemplateQuery, reportTemplatesQuery, savedReportQuery } from "@/lib/queries";
import {
  chartValueKeys,
  emptyLayout,
  firstOpening,
  layoutError,
  listColumnKeys,
  listColumnLabel,
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

function ReportSetup() {
  const organization = useOrganization();
  const router = useRouter();
  const templates = useQuery(reportTemplatesQuery(organization.id));
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [startFrom, setStartFrom] = useState("blank");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const chosen = templates.data?.find((item) => item.id === startFrom);
      const result = await createReportAction(organization.id, {
        name,
        isDefault,
        layout: chosen?.layout ?? emptyLayout(),
        filters: {},
      });
      if (!result.ok || !result.data) {
        throw new Error(result.ok ? "The report could not be saved." : result.error);
      }
      return result.data;
    },
    onSuccess: (saved) => router.replace(`/reports/${saved.id}/design`),
    onError: (caught) => setError(caught instanceof Error ? caught.message : "The report could not be saved."),
  });

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <PageHeader />
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Name" htmlFor="report-name">
          <Input id="report-name" value={name} maxLength={80} placeholder="Report name" onChange={(event) => setName(event.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
          Default report
        </label>
        <Field label="Start from" htmlFor="report-start">
          <SelectField
            id="report-start"
            value={startFrom}
            onValueChange={setStartFrom}
            options={[
              { value: "blank", label: "Blank" },
              ...(templates.data ?? []).map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Link href="/reports" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Cancel
          </Link>
          <Button type="submit" size="lg" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function useArrangeSave(
  enabled: boolean,
  layout: ReportLayout,
  filters: ReportFilters,
  save: (body: { layout: ReportLayout; filters: ReportFilters }) => Promise<void>,
) {
  const latest = useRef({ layout, filters, save });
  const saved = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { layout, filters, save };
  });

  useEffect(() => {
    if (!enabled) return;
    const current = JSON.stringify({ layout, filters });
    if (saved.current === null) {
      saved.current = current;
      return;
    }
    if (saved.current === current) return;
    const handle = window.setTimeout(() => {
      const body = { layout: latest.current.layout, filters: latest.current.filters };
      const text = JSON.stringify(body);
      void latest.current
        .save(body)
        .then(() => {
          saved.current = text;
        })
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [enabled, filters, layout]);

  useEffect(() => {
    return () => {
      if (!enabled || saved.current === null) return;
      const body = { layout: latest.current.layout, filters: latest.current.filters };
      if (JSON.stringify(body) === saved.current) return;
      void latest.current.save(body).catch(() => undefined);
    };
  }, [enabled]);
}

function ArrangeCanvas({
  mode,
  report,
  template,
}: {
  mode: "report" | "template";
  report?: SavedReport;
  template?: ReportTemplate;
}) {
  const organization = useOrganization();
  const { isAdmin, viewer } = useWorkspace();
  const copy = useLabels();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lookups } = useLookups();
  const { members } = useMembers();
  const templates = useQuery(reportTemplatesQuery(organization.id));
  const initialLayout = mode === "report" ? report!.layout : template!.layout;
  const initialFilters = mode === "report" ? report!.filters : {};
  const [layout, setLayout] = useState<ReportLayout>(initialLayout);
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [filterDraft, setFilterDraft] = useState<ReportFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [resetChoice, setResetChoice] = useState<ReportTemplate | "blank" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialLayout.cards[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const { editorOpen, zoom, setEditorOpen, setZoom } = useDesignerPreferences();
  const previewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const persist = useCallback(
    async (body: { layout: ReportLayout; filters: ReportFilters }) => {
      const problem = layoutError(body.layout);
      if (problem) {
        setError(problem);
        throw new Error(problem);
      }

      if (mode === "report") {
        const result = await updateReportAction(organization.id, report!.id, {
          layout: body.layout,
          filters: body.filters,
        });
        if (!result.ok) throw new Error(result.error);
        await queryClient.invalidateQueries({ queryKey: keys.savedReports(organization.id) });
        await queryClient.invalidateQueries({ queryKey: keys.savedReport(organization.id, report!.id) });
      } else if (template!.scope === "global" && !viewer.isSuperAdmin) {
        const result = await createReportTemplateAction(organization.id, {
          name: template!.name,
          layout: body.layout,
          baseTemplateId: template!.id,
        });
        if (!result.ok || !result.data) throw new Error(result.ok ? "The template could not be saved." : result.error);
        await queryClient.invalidateQueries({ queryKey: keys.reportTemplates(organization.id) });
        router.replace(`/reports/templates/${result.data.id}/design`);
      } else {
        const result = await updateReportTemplateAction(organization.id, template!.id, { layout: body.layout });
        if (!result.ok) throw new Error(result.error);
        await queryClient.invalidateQueries({ queryKey: keys.reportTemplates(organization.id) });
        await queryClient.invalidateQueries({ queryKey: keys.reportTemplate(organization.id, template!.id) });
      }

      setError(null);
    },
    [mode, organization.id, queryClient, report, router, template, viewer.isSuperAdmin],
  );

  useArrangeSave(true, layout, filters, persist);

  useEffect(() => {
    const frame = previewRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    const measure = () => {
      setFrameWidth(frame.clientWidth);
      setContentHeight(content.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(content);
    return () => observer.disconnect();
  }, [layout]);

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
  const paths = selected?.kind === "value" ? scalarAccessors : seriesAccessors;
  const organizationVersion = templates.data?.find((item) => item.baseTemplateId === template?.id);
  const saveTemplate = useMutation({
    mutationFn: async () => {
      const problem = layoutError(layout);
      if (problem) throw new Error(problem);
      const result = await createReportTemplateAction(organization.id, { name: templateName, layout });
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.reportTemplates(organization.id) });
      setSaveTemplateOpen(false);
      setTemplateName("");
      setError(null);
    },
    onError: (caught) => setError(caught instanceof Error ? caught.message : "The template could not be saved."),
  });

  function setDraftFilter(key: keyof ReportFilters, value: string) {
    setFilterDraft((current) => {
      const next = { ...current };
      if (!value || value === "any") delete next[key];
      else next[key] = value;
      return next;
    });
  }

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

  function applyReset() {
    if (!resetChoice) return;
    const next = resetChoice === "blank" ? emptyLayout() : resetChoice.layout;
    setLayout(next);
    setSelectedId(next.cards[0]?.id ?? null);
    if (next.cards[0]) setEditorOpen(true);
    setResetChoice(null);
  }

  const problem = layoutError(layout);
  const templateNote =
    mode === "template" && template
      ? template.scope === "override"
        ? "This is your organization's version."
        : template.scope === "global" && viewer.isSuperAdmin
          ? "Editing the global template."
          : "Saving creates your organization's version of this template."
      : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className={cn("grid min-h-0 flex-1 gap-3", editorOpen && "grid-cols-[minmax(0,1fr)_18rem]")}>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <h2 className="text-sm font-medium">Preview</h2>
              {templateNote ? <p className="text-xs text-muted-foreground">{templateNote}</p> : null}
              {mode === "template" && template?.scope === "global" && viewer.isSuperAdmin && organizationVersion ? (
                <Link href={`/reports/templates/${organizationVersion.id}/design`} className="text-xs underline">
                  Edit organization version
                </Link>
              ) : null}
              {mode === "template" && template?.scope === "override" && template.baseTemplateId && viewer.isSuperAdmin ? (
                <Link href={`/reports/templates/${template.baseTemplateId}/design`} className="text-xs underline">
                  Edit global
                </Link>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {preview.isFetching ? <p className="text-xs text-muted-foreground">Updating…</p> : null}
              <Button type="button" variant="outline" size="icon" aria-label="Add value card" onClick={() => addCard("value")}>
                <HashIcon />
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Add chart card" onClick={() => addCard("chart")}>
                <ChartColumnIcon />
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Add list card" onClick={() => addCard("list")}>
                <ListIcon />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>Reset</DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setResetChoice("blank")}>Blank</DropdownMenuItem>
                  {(templates.data ?? []).map((item) => (
                    <DropdownMenuItem key={item.id} onClick={() => setResetChoice(item)}>
                      {item.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {mode === "report" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFilterDraft(filters);
                    setFiltersOpen(true);
                  }}
                >
                  {filterCount > 0 ? `Edit filters (${filterCount})` : "Add filters"}
                </Button>
              ) : null}
              {mode === "report" && isAdmin ? (
                <Button type="button" variant="outline" onClick={() => setSaveTemplateOpen(true)}>
                  Save as template
                </Button>
              ) : null}
              <PreviewZoom zoom={zoom} onZoom={setZoom} />
              <Button type="button" variant="ghost" size="icon" aria-label="Report builder instructions" onClick={() => setHelpOpen(true)}>
                <CircleHelpIcon />
              </Button>
            </div>
          </div>
          <div ref={previewRef} className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3">
            <div style={{ width: frameWidth ? frameWidth * zoom : "100%", height: contentHeight ? contentHeight * zoom : undefined }}>
              <div ref={contentRef} style={{ width: frameWidth || "100%", transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                {layout.cards.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add a card, or reset to a template.</p>
                ) : null}
                <ReportGrid
                  cards={layout.cards}
                  data={preview.data}
                  editing
                  scroll={false}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setEditorOpen(true);
                  }}
                  onChange={(cards) => setLayout({ version: 1, cards })}
                />
              </div>
            </div>
          </div>
        </section>
        {editorOpen ? (
          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Card editor</h2>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setEditorOpen(false)}>
                <XIcon />
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
      {error ? <p className="shrink-0 text-sm text-destructive">{error}</p> : null}
      {problem ? <p className="shrink-0 text-sm text-destructive">{problem}</p> : null}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Report builder</DialogTitle>
            <DialogDescription>How to arrange cards and save this report.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <p><span className="font-medium">Layout. </span>Drag a card to move it. Drag the top, right, bottom, or left edge to resize it. Cards cannot overlap.</p>
            <p><span className="font-medium">Cards. </span>The header icons add a value, chart, or list card. Reset replaces every card with Blank or a template after confirmation. Click a card to select it and open the card editor. The editor edits title, description, data, and format, plus color and icon for a value, chart type, palette, and value for a chart, or columns for a list. Delete removes the selected card. The close icon hides the editor; clicking a card opens it again.</p>
            <p><span className="font-medium">Preview. </span>Zoom with the header controls, the percentage (resets to 100%), or Ctrl/Cmd + scroll over the preview. The preview uses the report filters and shows Updating while data reloads.</p>
            <p><span className="font-medium">Report. </span>Name, default, and the starting layout are chosen before the preview opens. Filters for date range, department, task category, project, and person apply to the preview. Card, layout, and filter changes save automatically. An organization admin can save the layout as an organization template. A SuperAdmin edits a global template. An organization admin who saves a global template creates an override that replaces it for this organization.</p>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={resetChoice !== null}
        onOpenChange={(open) => {
          if (!open) setResetChoice(null);
        }}
        title="Reset the layout?"
        description={
          resetChoice === "blank"
            ? "The current cards will be replaced with a blank layout."
            : `The current cards will be replaced with ${resetChoice?.name ?? "this template"}.`
        }
        confirmLabel="Reset"
        onConfirm={applyReset}
      />
      {mode === "report" ? (
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
      ) : null}
      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>This layout is saved for your organization. Reports that already use a copy do not change.</DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="template-name">
            <Input id="template-name" value={templateName} maxLength={80} onChange={(event) => setTemplateName(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSaveTemplateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saveTemplate.isPending} onClick={() => saveTemplate.mutate()}>
              {saveTemplate.isPending ? "Saving…" : "Save"}
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

  if (!reportId) return <ReportSetup />;
  if (existing.isPending) return <StatsSkeleton />;
  if (existing.isError || !existing.data) {
    return <p className="text-sm text-muted-foreground">That report is not available.</p>;
  }

  return <ArrangeCanvas key={existing.data.id} mode="report" report={existing.data} />;
}

export function TemplateDesigner({ templateId }: { templateId: string }) {
  const organization = useOrganization();
  const existing = useQuery(reportTemplateQuery(organization.id, templateId));

  if (existing.isPending) return <StatsSkeleton />;
  if (existing.isError || !existing.data) {
    return <p className="text-sm text-muted-foreground">That template is not available.</p>;
  }

  return <ArrangeCanvas key={existing.data.id} mode="template" template={existing.data} />;
}
