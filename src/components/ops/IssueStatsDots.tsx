import Link from "next/link";
import type { IssueBucket, IssueStats } from "@/src/lib/ops/overview-tree";
import { cn } from "@/src/lib/utils";

const BUCKETS = [
  { key: "open" as const, label: "Open", dot: "bg-info", text: "text-info" },
  { key: "urgent" as const, label: "Urgent", dot: "bg-destructive", text: "text-destructive" },
  { key: "blocked" as const, label: "Blocked", dot: "bg-destructive/80", text: "text-destructive" },
  { key: "overdue" as const, label: "Due", dot: "bg-warning", text: "text-warning-foreground" },
  { key: "done" as const, label: "Done", dot: "bg-success", text: "text-success" },
];

export function IssueStatsDots({
  stats,
  hrefPrefix = "/issues",
  size = "sm",
  className,
}: {
  stats: IssueStats;
  hrefPrefix?: string;
  size?: "sm" | "xs";
  className?: string;
}) {
  const visible = BUCKETS.filter((bucket) => stats[bucket.key] > 0);
  if (visible.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {visible.map((bucket) => {
        const count = stats[bucket.key];
        const href = bucketHref(hrefPrefix, bucket.key);
        const pill = (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border border-border/80 bg-background/80 tabular-nums",
              size === "xs" ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
              count > 0 && bucket.key === "urgent" && "border-destructive/40 bg-destructive/10"
            )}
          >
            <span className={cn("shrink-0 rounded-full", size === "xs" ? "h-1.5 w-1.5" : "h-2 w-2", bucket.dot)} aria-hidden />
            <span className={cn("font-medium", bucket.text)}>{count}</span>
          </span>
        );

        return hrefPrefix ? (
          <Link key={bucket.key} href={href} className="hover:opacity-80" title={`${count} ${bucket.label}`}>
            {pill}
          </Link>
        ) : (
          <span key={bucket.key} title={`${count} ${bucket.label}`}>
            {pill}
          </span>
        );
      })}
    </span>
  );
}

function bucketHref(prefix: string, bucket: IssueBucket) {
  const joiner = prefix.includes("?") ? "&" : "?";
  if (bucket === "done") return `${prefix}${joiner}status=closed`;
  if (bucket === "urgent") return `${prefix}${joiner}status=openish&priority=urgent`;
  if (bucket === "blocked") return `${prefix}${joiner}status=blocked`;
  if (bucket === "overdue") return `${prefix}${joiner}status=openish&due=overdue`;
  return `${prefix}${joiner}status=openish`;
}
