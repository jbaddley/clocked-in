import { BarChart3Icon, ClockIcon, HandCoinsIcon, TimerIcon } from "lucide-react";
import Link from "next/link";

const highlights = [
  { icon: TimerIcon, title: "Log in seconds", text: "Live timers, start and end times, or total hours." },
  { icon: HandCoinsIcon, title: "Valued for grants", text: "Every hour priced at your volunteer rate." },
  { icon: BarChart3Icon, title: "Reports that travel", text: "Break down hours by project, person, and team." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[#001836] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-[#D4AC59]/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-[#4EBFAE]/20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#D4AC59] text-[#001836]">
            <ClockIcon className="size-5" />
          </span>
          Clocked In
        </Link>
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
      <main className="flex flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:px-8">
        <Link href="/" className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClockIcon className="size-4" />
          </span>
          Clocked In
        </Link>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
