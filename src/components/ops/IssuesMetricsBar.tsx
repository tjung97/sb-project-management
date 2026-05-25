import Link from "next/link";
import type { IssueStats } from "@/src/lib/ops/overview-tree";
import { cn } from "@/src/lib/utils";

const items = [
  { key: "open" as const, label: "Open", href: "/issues?status=openish", dot: "bg-info" },
  { key: "urgent" as const, label: "Urgent", href: "/issues?status=openish&priority=urgent", dot: "bg-destructive" },
  { key: "blocked" as const, label: "Blocked", href: "/issues?status=blocked", dot: "bg-destructive/70" },
  { key: "overdue" as const, label: "Overdue", href: "/issues?status=openish&due=overdue", dot: "bg-warning" },
  { key: "done" as const, label: "Done", href: "/issues?status=closed", dot: "bg-success" },
];

export function IssuesMetricsBar({ stats }: { stats: IssueStats }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs transition hover:bg-accent/50",
            item.key === "urgent" && stats.urgent > 0 && "border-destructive/40 bg-destructive/5"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} aria-hidden />
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-semibold tabular-nums text-foreground">{stats[item.key]}</span>
        </Link>
      ))}
    </div>
  );
}
