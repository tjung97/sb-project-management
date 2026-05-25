import { AlertTriangle, Ban, CheckCircle2, Circle, Flame } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { priorityLabel, statusLabel } from "@/src/lib/ops/format";
import { priorityStyles } from "@/src/lib/ops/semantic";
import { cn } from "@/src/lib/utils";
import type { IssuePriority, IssueStatus } from "@/src/types/firestore";

export function StatusBadge({ status, showPulse = false }: { status: IssueStatus; showPulse?: boolean }) {
  const label = statusLabel(status);

  if (status === "blocked") {
    return (
      <Badge variant="destructive" className="gap-1 border-destructive/50 pl-1.5">
        <Ban className="h-3 w-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (status === "done" || status === "closed") {
    return (
      <Badge variant="success" className="gap-1 pl-1.5">
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (status === "in_progress") {
    return (
      <Badge variant="info" className="gap-1 pl-1.5">
        <span className={cn("inline-flex h-2 w-2 rounded-full bg-info", showPulse && "status-pulse-dot")} aria-hidden />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 pl-1.5">
      <Circle className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}

export function PriorityBadge({ priority, prominent = false }: { priority: IssuePriority; prominent?: boolean }) {
  const style = priorityStyles[priority];
  const label = priorityLabel(priority);

  if (priority === "urgent") {
    return (
      <Badge
        variant="urgent"
        className={cn("pl-1.5 uppercase tracking-wide", prominent && "px-2.5 py-1 text-[11px]")}
        aria-label="Urgent priority"
      >
        <span className="urgent-pulse-dot inline-flex h-2 w-2 shrink-0 rounded-full bg-destructive-foreground" aria-hidden />
        <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (priority === "high") {
    return (
      <Badge variant="warning" className="gap-1 border-warning/40 pl-1.5">
        <AlertTriangle className="h-3 w-3" aria-hidden />
        {label}
      </Badge>
    );
  }

  return <Badge variant={style.badgeVariant} className="gap-1 pl-1.5">{label}</Badge>;
}
