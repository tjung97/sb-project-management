import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";

export function PlaceholderDashboard({
  title,
  description,
  focus,
}: {
  title: string;
  description: string;
  focus: string[];
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Seoul Bowl operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{description}</CardTitle>
          <CardDescription>This area is connected to the same issue/project system so work does not disappear into chats or email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {focus.map((item) => (
              <div key={item} className="rounded-lg border border-border bg-secondary/50 p-4 text-sm">
                {item}
              </div>
            ))}
          </div>
          <Link
            href="/issues"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Open issue queue
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
