import type { Metadata } from "next";
import { OwnTimeView } from "./own-view";

export const metadata: Metadata = { title: "Log time" };

export default function OwnTimePage() {
  return <OwnTimeView />;
}
