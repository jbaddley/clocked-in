import { PeopleShell } from "./people-shell";

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return <PeopleShell>{children}</PeopleShell>;
}
