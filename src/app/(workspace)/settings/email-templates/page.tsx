import type { Metadata } from "next";
import { EmailTemplatesView } from "./email-templates-view";

export const metadata: Metadata = { title: "Email Templates" };

export default function EmailTemplatesPage() {
  return <EmailTemplatesView />;
}
