import type { Metadata } from "next";
import { ConnectionsTimeView } from "./connections-view";

export const metadata: Metadata = { title: "Log connection time" };

export default function ConnectionsTimePage() {
  return <ConnectionsTimeView />;
}
