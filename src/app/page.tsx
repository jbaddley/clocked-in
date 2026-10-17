import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6">
      <p className="text-xs font-semibold uppercase tracking-widest">Clocked In</p>
      <h1 className="text-4xl font-semibold tracking-tight">Track volunteer time</h1>
      <p className="text-muted-foreground">
        Log hours, value them for grants, and let each organization bring its own colors and marks.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className={cn(buttonVariants())}>Sign in</Link>
        <Link href="/signup" className={cn(buttonVariants({ variant: "outline" }))}>Create an account</Link>
      </div>
    </main>
  );
}
