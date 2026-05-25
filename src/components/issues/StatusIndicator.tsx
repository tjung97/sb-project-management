import { statusLabel } from "@/src/lib/ops/format";
import { cn } from "@/src/lib/utils";
import type { IssueStatus } from "@/src/types/firestore";

export function statusDotClassName(status: IssueStatus) {
  switch (status) {
    case "blocked":
      return "bg-destructive/80";
    case "done":
    case "closed":
      return "bg-success/80";
    case "in_progress":
      return "bg-info/75";
    default:
      return "bg-muted-foreground/55";
  }
}

export function StatusIndicator({
  status,
  showPulse = false,
  className,
}: {
  status: IssueStatus;
  showPulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          statusDotClassName(status),
          showPulse && status === "in_progress" && "status-pulse-dot"
        )}
        aria-hidden
      />
      <span className="font-medium text-foreground/90">{statusLabel(status)}</span>
    </span>
  );
}
