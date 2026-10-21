import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/lib/server/dal";
import { AboutPrototypeView } from "./about-prototype-view";

export const metadata: Metadata = { title: "Guide" };

export default async function AboutPrototypePage() {
  const workspace = await getWorkspace();
  if (!workspace.isAdmin) {
    redirect("/dashboard");
  }

  return <AboutPrototypeView />;
}
