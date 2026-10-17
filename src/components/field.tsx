import { cn } from "cn";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  action,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex h-5 items-center justify-between gap-1">
        <Label htmlFor={htmlFor} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </Label>
        {action}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FormMessage({ result }: { result: { ok: boolean; error?: string; message?: string } | null }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 font-sans text-sm text-destructive">
        {result.error}
      </p>
    );
  }

  return result.message ? (
    <p role="status" className="rounded-lg bg-success/10 px-3 py-2 font-sans text-sm text-success">
      {result.message}
    </p>
  ) : null;
}
