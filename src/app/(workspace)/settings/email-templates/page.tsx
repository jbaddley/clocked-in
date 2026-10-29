import { redirect } from "next/navigation";

export default function EmailTemplatesRedirectPage() {
  redirect("/settings/email");
}
