import { BarChart3Icon, HandCoinsIcon, TimerIcon } from "lucide-react";
import { Suspense } from "react";
import { brandCss } from "@/lib/brand";
import { getAuthBrand } from "@/lib/server/auth-brand";
import { AuthBrand } from "./auth-brand";

const highlights = [
  { icon: TimerIcon, title: "Log in seconds", text: "Live timers, start and end times, or total hours." },
  { icon: HandCoinsIcon, title: "Valued for grants", text: "Every hour priced at your volunteer rate." },
  { icon: BarChart3Icon, title: "Reports that travel", text: "Break down hours by project, person, and team." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<AuthShellSkeleton />}>
      <AuthShell>{children}</AuthShell>
    </Suspense>
  );
}

async function AuthShell({ children }: { children: React.ReactNode }) {
  const organization = await getAuthBrand();
  const css = brandCss(organization?.theme ?? null);

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <aside className="brand-hero-navy relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col">
        <div className="brand-rule absolute inset-x-0 top-0" />
        <AuthBrand organization={organization} surface="dark" />
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">Every volunteer hour, counted and valued.</h2>
          <ul className="mt-8 flex flex-col gap-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <item.icon className="size-5 text-[#D4AC59]" />
                </span>
                <span>
                  <span className="block font-medium">{item.title}</span>
                  <span className="text-sm text-white/70">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center bg-muted px-4 py-10 sm:px-8">
        <div className="mb-8 lg:hidden">
          <AuthBrand organization={organization} surface="light" />
        </div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function AuthShellSkeleton() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="brand-hero-navy relative hidden overflow-hidden lg:block" />
      <main className="flex flex-col items-center justify-center bg-muted px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-pulse rounded-xl border bg-card p-6 shadow-sm">
          <div className="h-7 w-48 rounded-md bg-muted" />
          <div className="mt-3 h-4 w-full rounded-md bg-muted" />
          <div className="mt-6 h-10 w-full rounded-md bg-muted" />
          <div className="mt-4 h-10 w-full rounded-md bg-muted" />
        </div>
      </main>
    </div>
  );
}
