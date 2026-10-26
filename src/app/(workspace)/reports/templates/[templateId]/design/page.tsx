import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportAccess } from "../../../report-access";
import { TemplateDesigner } from "../../../report-designer";

export const metadata: Metadata = { title: "Design template" };
export const instant = false;

export default async function TemplateDesignPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return (
    <Suspense>
      <ReportAccess admin>
        <TemplateDesigner templateId={templateId} />
      </ReportAccess>
    </Suspense>
  );
}
