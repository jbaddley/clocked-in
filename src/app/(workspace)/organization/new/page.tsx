import type { Metadata } from "next";
import { NewOrganizationView } from "./new-organization-view";

export const metadata: Metadata = { title: "New organization" };

export default function NewOrganizationPage() {
  return <NewOrganizationView />;
}