import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/skeletons";

export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="relative gap-6 overflow-hidden py-6 shadow-sm [--card-spacing:--spacing(6)]">
      <div className="brand-rule absolute inset-x-0 top-0" />
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">{footer}</CardFooter> : null}
    </Card>
  );
}

export function AuthFormSkeleton({}: { fields?: number }) {
  return <PageLoader className="min-h-48 py-6" />;
}
