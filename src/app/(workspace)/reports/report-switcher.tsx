"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/select-field";
import { useOrganization, useWorkspace } from "@/hooks/use-workspace";
import { savedReportsQuery } from "@/lib/queries";

export function useSavedReports() {
  const organization = useOrganization();
  const query = useQuery(savedReportsQuery(organization.id));
  return { ...query, reports: query.data ?? [] };
}

export function ReportSwitcher({
  active,
}: {
  active: "standard" | string;
}) {
  const router = useRouter();
  const { isAdmin } = useWorkspace();
  const { reports } = useSavedReports();
  if (reports.length === 0 && !isAdmin) return null;

  const options = [
    { value: "standard", label: "Standard" },
    ...reports.map((report) => ({
      value: report.id,
      label: report.isDefault ? `${report.name} (default)` : report.name,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reports.length > 0 ? (
        <SelectField
          aria-label="Report"
          className="w-56"
          value={options.some((option) => option.value === active) ? active : "standard"}
          onValueChange={(value) => {
            if (!value || value === active) return;
            if (value === "standard") {
              router.push("/reports/standard");
              return;
            }

            const report = reports.find((item) => item.id === value);
            router.push(report?.isDefault ? "/reports" : `/reports/${value}`);
          }}
          options={options}
        />
      ) : null}
    </div>
  );
}
