import type { Metadata } from "next";
import { ThemeForm } from "./theme-form";

export const metadata: Metadata = { title: "Theme settings" };

export default function ThemeSettingsPage() {
  return <ThemeForm />;
}
