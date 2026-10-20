import type { Metadata } from "next";
import { GroupTimeView } from "./group-view";

export const metadata: Metadata = { title: "Log group time" };

export default function GroupTimePage() {
  return <GroupTimeView />;
}
