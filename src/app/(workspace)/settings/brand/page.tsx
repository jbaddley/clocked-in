import type { Metadata } from "next";
import { BrandForm } from "./brand-form";

export const metadata: Metadata = { title: "Brand settings" };

export default function BrandSettingsPage() {
  return <BrandForm />;
}
