"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ChartColumnIcon, CircleHelpIcon, HashIcon, InboxIcon, ListIcon, XIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { useSavedReports } from "@/hooks/use-saved-reports";
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
import { useReport } from "@/hooks/use-report";
import { useReportEntries, withEntries } from "@/hooks/use-report-entries";
import { keys, reportTemplateQuery, reportTemplatesQuery, savedReportQuery } from "@/lib/queries";
import {
  chartValueKeys,
  dashboardLayout,
  emptyLayout,
  entriesLimitDefault,
  entriesLimitMax,
  entriesScopes,
  firstOpening,
  layoutError,
  listColumnKeys,
  listColumnLabel,
  listLimitMax,
  listSortDirs,
  listSortKeys,
  builtinTemplateIds,
  reportTemplate,
  reportTemplateIds,
  reportTemplateLabel,
  valueColors,
  valueFormats,
  type ReportCard,
  type ReportLayout,
  type ValueColor,
} from "@/lib/report-layout";
import { scalarAccessors, seriesAccessors } from "@/lib/report-path";
import { isReportId, reportPath, slugForSavedReport, standardSlugForKey } from "@/lib/report-slug";
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

function builtinTemplates(copy: { department: string; taskCategory: string; project: string }): ReportTemplate[] {
  return reportTemplateIds.map((id) => ({
    id: builtinTemplateIds[id],
    organizationId: null,
    key: id,
    name: reportTemplateLabel(id),
    layout: reportTemplate(id, copy),
    baseTemplateId: null,
    scope: "global",
    createdAt: "",
    updatedAt: "",
  }));
}

function useTemplateChoices() {
  const organization = useOrganization();
  const { department, taskCategory, project } = useLabels();
  const builtin = useMemo(
    () => builtinTemplates({ department, taskCategory, project }),
    [department, taskCategory, project],
  );
  const templates = useQuery({
    ...reportTemplatesQuery(organization.id),
    placeholderData: builtin,
  });
  return { organization, templates, choices: templates.data?.length ? templates.data : builtin };
}

function ReportSetup() {
  const router = useRouter();
  const { organization, choices } = useTemplateChoices();
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [startFrom, setStartFrom] = useState("blank");
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const chosen = choices.find((item) => item.id === startFrom);
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
    onSuccess: (saved) => router.replace(`/reports/${slugForSavedReport(saved.name)}/design`),
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
              ...choices.map((item) => ({ value: item.id, label: item.name })),
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

function useArrangeSave(enabled: boolean, layout: ReportLayout, save: (layout: ReportLayout) => Promise<void>) {
  const latest = useRef({ layout, save });
  const saved = useRef<string | null>(null);

  useEffect(() => {
    latest.current = { layout, save };
  });

  useEffect(() => {
    if (!enabled) return;
    const current = JSON.stringify(layout);
    if (saved.current === null) {
      saved.current = current;
      return;
    }
    if (saved.current === current) return;
    const handle = window.setTimeout(() => {
      const next = latest.current.layout;
      const text = JSON.stringify(next);
      void latest.current
        .save(next)
        .then(() => {
          saved.current = text;
        })
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [enabled, layout]);

  useEffect(() => {
    return () => {
      if (!enabled || saved.current === null) return;
      const next = latest.current.layout;
      if (JSON.stringify(next) === saved.current) return;
      void latest.current.save(next).catch(() => undefined);
    };
  }, [enabled]);
}

function ArrangeCanvas({
  mode,
  report,
  template,
  dashboard = false,
}: {
  mode: "report" | "template";
  report?: SavedReport;
  template?: ReportTemplate;
  dashboard?: boolean;
}) {
  const organization = useOrganization();
  const { isAdmin, viewer } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { choices, templates } = useTemplateChoices();
  const initialLayout = mode === "report" ? report!.layout : template!.layout;
  const [layout, setLayout] = useState<ReportLayout>(initialLayout);
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

  const reportIdRef = useRef(report?.id ?? "");

  const persist = useCallback(
    async (nextLayout: ReportLayout) => {
      const problem = layoutError(nextLayout);
      if (problem) {
        setError(problem);
        throw new Error(problem);
      }

      if (mode === "report") {
        if (!reportIdRef.current) {
          const result = await createReportAction(organization.id, {
            name: report?.name || "Dashboard",
            isDashboard: dashboard,
            layout: nextLayout,
            filters: {},
          });
          if (!result.ok || !result.data) throw new Error(result.ok ? "The report could not be saved." : result.error);
          reportIdRef.current = result.data.id;
          await queryClient.invalidateQueries({ queryKey: keys.savedReports(organization.id) });
          await queryClient.invalidateQueries({ queryKey: keys.savedReport(organization.id, result.data.id) });
        } else {
          const result = await updateReportAction(organization.id, reportIdRef.current, {
            layout: nextLayout,
            filters: {},
          });
          if (!result.ok) throw new Error(result.error);
          await queryClient.invalidateQueries({ queryKey: keys.savedReports(organization.id) });
          await queryClient.invalidateQueries({ queryKey: keys.savedReport(organization.id, reportIdRef.current) });
        }
      } else if (template!.scope === "global" && !viewer.isSuperAdmin) {
        const result = await createReportTemplateAction(organization.id, {
          name: template!.name,
          layout: nextLayout,
          baseTemplateId: template!.id,
        });
        if (!result.ok || !result.data) throw new Error(result.ok ? "The template could not be saved." : result.error);
        await queryClient.invalidateQueries({ queryKey: keys.reportTemplates(organization.id) });
        router.replace(`/reports/templates/${result.data.id}/design`);
      } else {
        const result = await updateReportTemplateAction(organization.id, template!.id, { layout: nextLayout });
        if (!result.ok) throw new Error(result.error);
        await queryClient.invalidateQueries({ queryKey: keys.reportTemplates(organization.id) });
        await queryClient.invalidateQueries({ queryKey: keys.reportTemplate(organization.id, template!.id) });
      }

      setError(null);
    },
    [dashboard, mode, organization.id, queryClient, report, router, template, viewer.isSuperAdmin],
  );

  useArrangeSave(true, layout, persist);

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

  const preview = useReport({});
  const { entries } = useReportEntries();
  const previewData = withEntries(preview.data, entries);
  const selected = layout.cards.find((card) => card.id === selectedId) ?? null;
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

  function patch(id: string, change: Partial<ReportCard>) {
    setLayout((current) => ({
      version: 1,
      cards: current.cards.map((card) => (card.id === id ? ({ ...card, ...change } as ReportCard) : card)),
    }));
  }

  function addCard(kind: ReportCard["kind"]) {
    const columns = kind === "value" ? 3 : kind === "entries" ? 12 : 6;
    const rows = kind === "value" ? 1 : kind === "chart" ? 4 : 5;
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
          : kind === "entries"
            ? {
                id: crypto.randomUUID(),
                kind,
                title: "Recent entries",
                description: "",
                accessor: "entries.mine",
                scope: "mine",
                limit: entriesLimitDefault,
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
              <Link
                href={
                  dashboard
                    ? "/dashboard"
                    : mode === "template"
                      ? reportPath(standardSlugForKey(template?.key) ?? "summary")
                      : report?.name
                        ? reportPath(slugForSavedReport(report.name))
                        : "/reports"
                }
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <ArrowLeftIcon className="size-4" />
                {dashboard ? "Dashboard" : "Reports"}
              </Link>
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
              <Button type="button" variant="outline" size="icon" aria-label="Add entries card" onClick={() => addCard("entries")}>
                <InboxIcon />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>Reset</DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setResetChoice("blank")}>Blank</DropdownMenuItem>
                  {choices.map((item) => (
                    <DropdownMenuItem key={item.id} onClick={() => setResetChoice(item)}>
                      {item.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
                  data={previewData}
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
        <DialogContent className="flex max-h-[min(40rem,85vh)] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>Report builder</DialogTitle>
            <DialogDescription>How to arrange cards and save this report.</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto text-sm">
            <p><span className="font-medium">Layout. </span>Drag a card to move it. Drag the top, right, bottom, or left edge to resize it. Cards cannot overlap.</p>
            <p><span className="font-medium">Cards. </span>The header icons add a value, chart, or list card. Reset replaces every card with Blank or a template after confirmation. Click a card to select it and open the card editor. The editor edits title, description, data, and format, plus color and icon for a value, chart type, palette, and value for a chart, or columns for a list. Delete removes the selected card. The close icon hides the editor; clicking a card opens it again.</p>
            <p><span className="font-medium">Preview. </span>Zoom with the header controls, the percentage (resets to 100%), or Ctrl/Cmd + scroll over the preview. The preview uses all-time organization data and shows Updating while data reloads. Date range and other filters live on the report page.</p>
            <p><span className="font-medium">Report. </span>Name, default, and the starting layout are chosen before the preview opens. Card and layout changes save automatically. An organization admin can save the layout as an organization template. A SuperAdmin edits a global template. An organization admin who saves a global template creates an override that replaces it for this organization.</p>
          </div>
          <DialogFooter showCloseButton />
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
  if (card.kind === "entries") {
    return (
      <>
        <Field label="Title" htmlFor="card-title">
          <Input id="card-title" value={card.title} onChange={(event) => onPatch({ title: event.target.value })} />
        </Field>
        <Field label="Description" htmlFor="card-description">
          <Textarea id="card-description" value={card.description} onChange={(event) => onPatch({ description: event.target.value })} />
        </Field>
        <Field label="Scope" htmlFor="card-scope">
          <SelectField
            id="card-scope"
            value={card.scope}
            onValueChange={(scope) => {
              if (scope === "mine" || scope === "organization") {
                onPatch({ scope, accessor: `entries.${scope}` } as Partial<ReportCard>);
              }
            }}
            options={entriesScopes.map((value) => ({
              value,
              label: value === "mine" ? "My entries" : "Organization entries",
            }))}
          />
        </Field>
        <Field label="Limit" htmlFor="card-limit">
          <Input
            id="card-limit"
            type="number"
            min={1}
            max={entriesLimitMax}
            value={card.limit}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next >= 1 && next <= entriesLimitMax) {
                onPatch({ limit: next } as Partial<ReportCard>);
              }
            }}
          />
        </Field>
        <Button type="button" variant="destructive" onClick={onDelete}>
          Delete card
        </Button>
      </>
    );
  }

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
      {card.kind === "list" ? (
        <>
          <Field label="Sort by" htmlFor="card-sort-key">
            <SelectField
              id="card-sort-key"
              value={card.sortKey ?? (card.limit !== undefined ? "hours" : "api")}
              onValueChange={(sortKey) => {
                if (sortKey === "api") {
                  onPatch({ sortKey: undefined } as Partial<ReportCard>);
                  return;
                }
                if (listSortKeys.includes(sortKey as (typeof listSortKeys)[number])) {
                  onPatch({ sortKey } as Partial<ReportCard>);
                }
              }}
              options={[
                { value: "api", label: "API order" },
                ...listSortKeys.map((value) => ({
                  value,
                  label: value === "people" ? "People" : value === "inKind" ? "In-kind" : value.charAt(0).toUpperCase() + value.slice(1),
                })),
              ]}
            />
          </Field>
          <Field label="Direction" htmlFor="card-sort-dir">
            <SelectField
              id="card-sort-dir"
              value={card.sortDir ?? "desc"}
              onValueChange={(sortDir) => {
                if (listSortDirs.includes(sortDir as (typeof listSortDirs)[number])) {
                  onPatch({ sortDir } as Partial<ReportCard>);
                }
              }}
              options={listSortDirs.map((value) => ({ value, label: value === "asc" ? "Ascending" : "Descending" }))}
            />
          </Field>
          <Field label="Limit" htmlFor="card-list-limit">
            <Input
              id="card-list-limit"
              type="number"
              min={1}
              max={listLimitMax}
              placeholder="No limit"
              value={card.limit ?? ""}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === "") {
                  onPatch({ limit: undefined } as Partial<ReportCard>);
                  return;
                }
                const next = Number(raw);
                if (Number.isInteger(next) && next >= 1 && next <= listLimitMax) {
                  onPatch({ limit: next } as Partial<ReportCard>);
                }
              }}
            />
          </Field>
        </>
      ) : null}
      <Button type="button" variant="destructive" onClick={onDelete}>
        Delete card
      </Button>
    </>
  );
}

export function ReportDesigner({ reportSlug, dashboard = false }: { reportSlug?: string; dashboard?: boolean }) {
  const organization = useOrganization();
  const router = useRouter();
  const { reports, isPending } = useSavedReports();
  const listed = reports.find(
    (item) => item.id === reportSlug || slugForSavedReport(item.name) === reportSlug,
  );
  const existing = useQuery({
    ...savedReportQuery(organization.id, reportSlug ?? ""),
    enabled: Boolean(reportSlug && isReportId(reportSlug) && !listed && !isPending),
  });
  const report = listed ?? existing.data ?? null;

  useEffect(() => {
    if (!reportSlug || !report || !isReportId(reportSlug)) return;
    const slug = slugForSavedReport(report.name);
    if (slug !== reportSlug) router.replace(`/reports/${slug}/design`);
  }, [report, reportSlug, router]);

  if (dashboard) {
    if (isPending) return <StatsSkeleton />;
    const saved = reports.find((item) => item.isDashboard);
    if (saved) return <ArrangeCanvas key={saved.id} mode="report" report={saved} dashboard />;
    return (
      <ArrangeCanvas
        key="dashboard-draft"
        mode="report"
        dashboard
        report={{
          id: "",
          organizationId: organization.id,
          name: "Dashboard",
          isDefault: false,
          isDashboard: true,
          layout: dashboardLayout(),
          filters: {},
          createdAt: "",
          updatedAt: "",
        }}
      />
    );
  }

  if (!reportSlug) return <ReportSetup />;
  if ((isPending && !listed) || existing.isPending) return <StatsSkeleton />;
  if (!report) {
    return <p className="text-sm text-muted-foreground">That report is not available.</p>;
  }

  return <ArrangeCanvas key={report.id} mode="report" report={report} />;
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
