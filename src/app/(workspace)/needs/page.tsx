import type { Metadata } from "next";
import { NeedsView } from "./needs-view";

export const metadata: Metadata = { title: "Needs" };

export default function NeedsPage() {
  return <NeedsView />;
}
