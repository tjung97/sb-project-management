import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { AvatarStack } from "@/src/components/ops/AvatarStack";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { PriorityBadge, StatusBadge } from "@/src/components/issues/IssueBadges";
import { Badge } from "@/src/components/ui/badge";
import { formatDate, formatIssueNumber } from "@/src/lib/ops/format";
import { isUrgentPriority, locationBorderClass, priorityBorderClass, priorityRowClass } from "@/src/lib/ops/semantic";
import { cn } from "@/src/lib/utils";
import type { IssueWithId, LabelWithId, LocationWithId, ProjectWithId, UserProfile } from "@/src/types/firestore";

export function IssueListRow({
  issue,
  project,
  location,
  issueLabels,
  userById,
  compact = false,
  isOverdue = false,
}: {
  issue: IssueWithId;
  project: ProjectWithId | null | undefined;
  location: LocationWithId | null | undefined;
  issueLabels: Array<LabelWithId | undefined>;
  userById: Map<string, UserProfile>;
  compact?: boolean;
  isOverdue?: boolean;
}) {
  const urgent = isUrgentPriority(issue.priority);
  const blocked = issue.status === "blocked";
  const overdue = isOverdue;
  const visibleLabels = issueLabels.filter(Boolean) as LabelWithId[];
  const labelOverflow = visibleLabels.length > 2 ? visibleLabels.length - 2 : 0;

  return (
    <Link
      href={`/issues/${issue.id}`}
      className={cn(
        "block border-l-4 transition-colors duration-150",
        urgent ? priorityBorderClass("urgent") : locationBorderClass(location?.kind),
        priorityRowClass(issue.priority),
        !urgent && "hover:bg-accent/40",
        blocked && !urgent && "bg-destructive/5",
        overdue && !blocked && !urgent && "bg-warning/5",
        compact ? "px-5 py-3.5" : "px-5 py-4 sm:py-5"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {urgent ? <PriorityBadge priority={issue.priority} prominent /> : null}
              <StatusBadge status={issue.status} showPulse />
              {!urgent ? <PriorityBadge priority={issue.priority} /> : null}
            </div>
            <p className="text-xs text-muted-foreground sm:hidden">Due {formatDate(issue.due_at)}</p>
          </div>

          <h2
            className={cn(
              "leading-snug text-foreground",
              urgent ? "font-semibold text-destructive" : "font-medium",
              compact ? "text-sm" : "text-base"
            )}
          >
            {issue.title}{" "}
            <span className="font-mono text-xs font-normal text-muted-foreground">{formatIssueNumber(issue)}</span>
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {location ? <LocationKindBadge kind={location.kind} name={location.name} /> : null}
            <Badge variant="muted">{issue.kind.replaceAll("_", " ")}</Badge>
            {visibleLabels.slice(0, 2).map((label) => (
              <Badge key={label.id} variant="outline">
                {label.name}
              </Badge>
            ))}
            {labelOverflow > 0 ? <Badge variant="outline">+{labelOverflow}</Badge> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/80">
            <span>{project ? project.title : "No project"}</span>
            <AvatarStack uids={issue.assignee_uids} usersById={userById} max={3} />
            {issue.checklist_total > 0 ? (
              <span className="text-xs text-muted-foreground">
                Checklist {issue.checklist_done}/{issue.checklist_total}
              </span>
            ) : null}
          </div>

          {!compact ? <p className="text-xs text-muted-foreground">{issue.last_activity_summary}</p> : null}
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground sm:flex">
          <p className="tabular-nums">Due {formatDate(issue.due_at)}</p>
          <p className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            <span className="tabular-nums">{issue.comment_count}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
