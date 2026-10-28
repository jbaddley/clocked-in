import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { portalName } from "@/lib/portal";
import { cn } from "cn";

export default function NotFound() {
  return (
    <main className='mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center'>
      <p className='text-xs font-semibold tracking-widest uppercase'>{portalName()}</p>
      <h1 className='text-2xl font-semibold tracking-tight'>Page not found</h1>
      <p className='text-sm text-muted-foreground'>That link does not match a screen in this app.</p>
      <Link href='/dashboard' className={cn(buttonVariants())}>
        Go to dashboard
      </Link>
    </main>
  );
}
