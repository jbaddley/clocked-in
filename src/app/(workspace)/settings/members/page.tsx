import type { Metadata } from "next";
import { MembersView } from "./members-view";

export const metadata: Metadata = { title: "People" };

export default function MembersPage() {
  return <MembersView />;
}
