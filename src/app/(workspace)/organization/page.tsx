import type { Metadata } from "next";
import { OrganizationView } from "./organization-view";

export const metadata: Metadata = { title: "Organization" };

export default function OrganizationPage() {
  return <OrganizationView />;
}
