import type { Metadata } from "next";
import { EmailSettingsView } from "./email-settings-view";

export const metadata: Metadata = { title: "Email settings" };

export default function EmailSettingsPage() {
  return <EmailSettingsView />;
}
