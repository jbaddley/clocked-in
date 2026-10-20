import type { Metadata } from "next";
import { ListsView } from "./lists-view";

export const metadata: Metadata = { title: "Projects and lists" };

export default function ListsPage() {
  return <ListsView />;
}
