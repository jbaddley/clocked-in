import type { Metadata } from "next";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Organization settings" };

export default function OrganizationSettingsPage() {
  return <OrganizationForm />;
}
