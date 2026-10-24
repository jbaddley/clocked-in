"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { ReportGrid } from "@/components/report-grid";
import { SelectField } from "@/components/select-field";
import { StatsSkeleton } from "@/components/skeletons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLabels } from "@/hooks/use-labels";
import { useLookups } from "@/hooks/use-lookups";
import { useMembers } from "@/hooks/use-members";
import { useOrganization } from "@/hooks/use-workspace";
import { HttpError, sendJson } from "@/lib/fetch-json";
import { keys, reportQuery, savedReportQuery } from "@/lib/queries";
import { scalarAccessors, seriesAccessors } from "@/lib/report-path";
import {
  chartFormats,
  emptyLayout,
  firstOpening,
  layoutError,
  normalizeFilters,
  normalizeLayout,
  normalizeReportName,
  summaryLayout,
  valueColors,
  valueFormats,
  valueIcons,
  chartValueKeys,
  type ReportCard,
  type ReportFilters,
  type ReportLayout,
} from "@/lib/report-layout";
import { chartTypes, paletteTypes, chartTypeLabel, paletteTypeLabel } from "@/lib/chart-palette";
import type { SavedReport } from "@/lib/api/features/saved-reports";
import { cn } from "cn";

function personName(member: { user: { displayName: string | null; firstName: string | null; lastName: string | null; username: string } }) {
  const display = member.user.displayName?.trim();
  if (display) return display;
  const full = [member.user.firstName, member.user.lastName].filter(Boolean).join(" ").trim();
  return full || member.user.username;
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
  const [selectedId, setSelectedId] = useState<string | null>(initial?.layout.cards[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const preview = useQuery(reportQuery(organization.id, filters));
  const selected = layout.cards.find((card) => card.id === selectedId) ?? null;

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
    const rows = kind === "value" ? 1 : 4;
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
            icon: "clock",
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
            ...spot,
          };
    setError(null);
    setLayout((current) => ({ version: 1, cards: [...current.cards, card] }));
    setSelectedId(card.id);
  }

  function setFilter(key: keyof ReportFilters, value: string) {
    setFilters((current) => {
      const next = { ...current };
      if (!value || value === "any") delete next[key];
      else next[key] = value;
      return next;
    });
  }

  const problem = layoutError(layout);
  const paths = selected?.kind === "chart" ? seriesAccessors : scalarAccessors;

  return (
    <>
      <PageHeader
        description="Drag a card to move it. Drag the left edge or the bottom edge to resize it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={initial ? (initial.isDefault ? "/reports" : `/reports/${initial.id}`) : "/reports"}
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              Close
            </Link>
            <Button type="button" size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Name" htmlFor="report-name">
              <Input id="report-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm md:mt-6">
              <Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
              Default report
            </label>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
            <DateRangeFilter
              range={{ from: filters.from, to: filters.to }}
              onChange={(range) =>
                setFilters((current) => {
                  const next = { ...current };
                  if (range.from) next.from = range.from;
                  else delete next.from;
                  if (range.to) next.to = range.to;
                  else delete next.to;
                  return next;
                })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SelectField
                aria-label={copy.department}
                value={filters.departmentId ?? "any"}
                onValueChange={(value) => setFilter("departmentId", value)}
                options={[{ value: "any", label: `Any ${copy.department.toLowerCase()}` }, ...lookups.departments.map((item) => ({ value: item.id, label: item.name }))]}
              />
              <SelectField
                aria-label={copy.taskCategory}
                value={filters.taskCategoryId ?? "any"}
                onValueChange={(value) => setFilter("taskCategoryId", value)}
                options={[{ value: "any", label: `Any ${copy.taskCategory.toLowerCase()}` }, ...lookups.categories.map((item) => ({ value: item.id, label: item.name }))]}
              />
              <SelectField
                aria-label={copy.project}
                value={filters.projectId ?? "any"}
                onValueChange={(value) => setFilter("projectId", value)}
                options={[{ value: "any", label: `Any ${copy.project.toLowerCase()}` }, ...lookups.projects.map((item) => ({ value: item.id, label: item.title }))]}
              />
              <SelectField
                aria-label="Person"
                value={filters.userId ?? "any"}
                onValueChange={(value) => setFilter("userId", value)}
                options={[{ value: "any", label: "Any person" }, ...members.map((member) => ({ value: member.userId, label: personName(member) }))]}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => addCard("value")}>
              Value card
            </Button>
            <Button type="button" variant="outline" onClick={() => addCard("chart")}>
              Chart card
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const next = summaryLayout(copy);
                setLayout(next);
                setSelectedId(next.cards[0]?.id ?? null);
                setError(null);
              }}
            >
              Start from the summary report
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
          {preview.isFetching ? <p className="text-xs text-muted-foreground">Updating…</p> : null}
          {layout.cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a card, or start from the summary report.</p>
          ) : null}
          <ReportGrid
            cards={layout.cards}
            data={preview.data}
            editing
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={(cards) => setLayout({ version: 1, cards })}
          />
        </div>
        <aside className="flex flex-col gap-3 rounded-xl border bg-card p-3">
          {selected ? (
            <>
              <Field label="Title" htmlFor="card-title">
                <Input id="card-title" value={selected.title} onChange={(event) => patch(selected.id, { title: event.target.value })} />
              </Field>
              <Field label="Description" htmlFor="card-description">
                <Textarea
                  id="card-description"
                  value={selected.description}
                  onChange={(event) => patch(selected.id, { description: event.target.value })}
                />
              </Field>
              <Field label="Data" htmlFor="card-accessor">
                <SelectField
                  id="card-accessor"
                  value={paths.some(([path]) => path === selected.accessor) ? selected.accessor : "custom"}
                  onValueChange={(value) => {
                    if (value !== "custom") patch(selected.id, { accessor: value });
                  }}
                  options={[...paths.map(([value, label]) => ({ value, label })), { value: "custom", label: "Custom path" }]}
                />
                <Input
                  aria-label="Data path"
                  className="mt-2"
                  value={selected.accessor}
                  onChange={(event) => patch(selected.id, { accessor: event.target.value })}
                />
              </Field>
              {selected.kind === "value" ? (
                <>
                  <Field label="Color" htmlFor="card-color">
                    <SelectField
                      id="card-color"
                      value={selected.color}
                      onValueChange={(color) => patch(selected.id, { color } as Partial<ReportCard>)}
                      options={valueColors.map((value) => ({ value, label: value }))}
                    />
                  </Field>
                  <Field label="Format" htmlFor="card-format">
                    <SelectField
                      id="card-format"
                      value={selected.format}
                      onValueChange={(format) => patch(selected.id, { format } as Partial<ReportCard>)}
                      options={valueFormats.map((value) => ({ value, label: value }))}
                    />
                  </Field>
                  <Field label="Icon" htmlFor="card-icon">
                    <SelectField
                      id="card-icon"
                      value={selected.icon ?? "none"}
                      onValueChange={(icon) => patch(selected.id, { icon: icon === "none" ? null : icon } as Partial<ReportCard>)}
                      options={[{ value: "none", label: "None" }, ...valueIcons.map((value) => ({ value, label: value }))]}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Chart type" htmlFor="card-chart">
                    <SelectField
                      id="card-chart"
                      value={selected.chartType}
                      onValueChange={(chartType) => patch(selected.id, { chartType } as Partial<ReportCard>)}
                      options={chartTypes.map((value) => ({ value, label: chartTypeLabel(value) }))}
                    />
                  </Field>
                  <Field label="Palette" htmlFor="card-palette">
                    <SelectField
                      id="card-palette"
                      value={selected.palette}
                      onValueChange={(palette) => patch(selected.id, { palette } as Partial<ReportCard>)}
                      options={paletteTypes.map((value) => ({ value, label: paletteTypeLabel(value) }))}
                    />
                  </Field>
                  <Field label="Value" htmlFor="card-value-key">
                    <SelectField
                      id="card-value-key"
                      value={selected.valueKey}
                      onValueChange={(valueKey) => patch(selected.id, { valueKey } as Partial<ReportCard>)}
                      options={chartValueKeys.map((value) => ({ value, label: value === "inKind" ? "In-kind value" : "Hours" }))}
                    />
                  </Field>
                  <Field label="Format" htmlFor="card-chart-format">
                    <SelectField
                      id="card-chart-format"
                      value={selected.format}
                      onValueChange={(format) => patch(selected.id, { format } as Partial<ReportCard>)}
                      options={chartFormats.map((value) => ({ value, label: value }))}
                    />
                  </Field>
                </>
              )}
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setLayout((current) => ({ version: 1, cards: current.cards.filter((card) => card.id !== selected.id) }));
                  setSelectedId(null);
                }}
              >
                Delete card
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a card to edit its title, color, and data.</p>
          )}
        </aside>
      </div>
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
