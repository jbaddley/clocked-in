import type { Metadata } from "next";
import { EmailTemplateEdit } from "./email-template-edit";

export const metadata: Metadata = { title: "Edit email template" };

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailTemplateEdit templateId={id} />;
}
