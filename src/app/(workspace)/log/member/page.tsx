import type { Metadata } from "next";
import { MemberTimeView } from "./member-view";

export const metadata: Metadata = { title: "Log member time" };

export default function MemberTimePage() {
  return <MemberTimeView />;
}
