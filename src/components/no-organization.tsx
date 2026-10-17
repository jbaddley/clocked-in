import { BuildingIcon } from "lucide-react";
import Link from "next/link";
import { NewOrganizationForm } from "@/components/shell/org-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoOrganization() {
  return (
    <Card className="mx-auto w-full max-w-lg gap-6 py-6 [--card-spacing:--spacing(6)]">
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BuildingIcon className="size-5" />
        </div>
        <CardTitle className="text-xl font-semibold">Set up your organization</CardTitle>
        <CardDescription>
          Create the organization you log time for, or{" "}
          <Link href="/accept" className="font-medium text-primary hover:underline">
            accept an invite
          </Link>{" "}
          to join an existing one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NewOrganizationForm />
      </CardContent>
    </Card>
  );
}
