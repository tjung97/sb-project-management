import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Ban, CheckCircle2, CircleDot, Flame } from "lucide-react";
import { cn } from "@/src/lib/utils";

export function IssuesMetrics({
  open,
  urgent,
  blocked,
  overdue,
  done,
}: {
  open: number;
  urgent: number;
  blocked: number;
  overdue: number;
  done: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard href="/issues?status=openish" icon={CircleDot} label="Open" value={open} />
      <MetricCard
        href="/issues?status=openish&priority=urgent"
        icon={Flame}
        label="Urgent"
        value={urgent}
        highlight={urgent > 0}
        urgentTone
      />
      <MetricCard href="/issues?status=blocked" icon={Ban} label="Blocked" value={blocked} highlight={blocked > 0} />
      <MetricCard href="/issues?status=openish&due=overdue" icon={AlertTriangle} label="Overdue" value={overdue} highlight={overdue > 0} />
      <MetricCard href="/issues?status=closed" icon={CheckCircle2} label="Done" value={done} />
    </div>
  );
}

function MetricCard({
  href,
  icon: Icon,
  label,
  value,
  highlight = false,
  urgentTone = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  highlight?: boolean;
  urgentTone?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg border bg-background px-3.5 py-3 shadow-card transition hover:border-primary/30 hover:bg-accent/30",
        urgentTone && highlight && "border-destructive/50 bg-destructive/10 hover:bg-destructive/15",
        !urgentTone && highlight && "border-destructive/40",
        !highlight && "border-border"
      )}
    >
      <div className={cn("flex items-center gap-2", urgentTone && highlight ? "text-destructive" : "text-muted-foreground")}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn("text-xl font-semibold tabular-nums", urgentTone && highlight && "text-destructive")}>{value}</p>
    </Link>
  );
}
