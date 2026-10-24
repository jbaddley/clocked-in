import { DeveloperShell } from "./developer-shell";

export default function DeveloperLayout({ children }: LayoutProps<"/developer">) {
  return <DeveloperShell>{children}</DeveloperShell>;
}
