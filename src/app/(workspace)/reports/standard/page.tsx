import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { reportPath } from "@/lib/report-slug";

export const metadata: Metadata = { title: "Reports" };
export const instant = false;

export default async function StandardReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value);
  }
  redirect(reportPath("summary", query));
}
