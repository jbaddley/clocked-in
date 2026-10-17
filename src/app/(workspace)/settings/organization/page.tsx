import type { Metadata } from "next";
import { NewOrganizationForm } from "@/components/shell/org-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationForm } from "./organization-form";

export const metadata: Metadata = { title: "Organization settings" };

export default function OrganizationSettingsPage() {
  return (
    <>
      <OrganizationForm />
      <Card>
        <CardHeader>
          <CardTitle>Another organization</CardTitle>
          <CardDescription>Volunteer somewhere else too? Create a separate organization and switch from the top bar.</CardDescription>
        </CardHeader>
        <CardContent>
          <NewOrganizationForm />
        </CardContent>
      </Card>
    </>
  );
}
