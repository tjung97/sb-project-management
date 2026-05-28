import Link from "next/link";
import { Flame, MessageSquare } from "lucide-react";
import { AvatarStack } from "@/src/components/ops/AvatarStack";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { PriorityBadge, StatusBadge } from "@/src/components/issues/IssueBadges";
import { RowStatusPicker } from "@/src/components/issues/RowStatusPicker";
import { Badge } from "@/src/components/ui/badge";
import { formatDate, formatIssueNumber, formatRelativeTime } from "@/src/lib/ops/format";
import { isUrgentPriority, priorityRowClass, statusBorderClass } from "@/src/lib/ops/semantic";
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
  const done = issue.status === "done" || issue.status === "closed";
  const visibleLabels = issueLabels.filter(Boolean) as LabelWithId[];
  const labelOverflow = visibleLabels.length > 2 ? visibleLabels.length - 2 : 0;
  const actionText = issue.status === "blocked"
    ? issue.next_step || issue.blocked_reason
    : issue.next_step;

  const rowBase = cn(
    "issue-row relative isolate block overflow-hidden border-l-4 transition-[background-color,box-shadow] duration-150",
    statusBorderClass(issue.status),
    priorityRowClass(issue.priority),
    !urgent && "hover:bg-accent/40",
    blocked && !urgent && "bg-destructive/5",
    isOverdue && !blocked && !urgent && "bg-warning/5",
  );

  if (compact) {
    const hasPreview = issue.comment_count > 0 && issue.last_comment_preview;
    return (
      <Link
        href={`/issues/${issue.id}`}
        className={cn(rowBase, "group px-4 py-2.5")}
        data-issue-id={issue.id}
        data-updated-at={issue.updated_at.toMillis()}
      >
        {/* Line 1: [status picker] · [urgent label] · title · #num · due · comments */}
        <div className="flex min-w-0 items-center gap-2">
          <RowStatusPicker issueId={issue.id} currentStatus={issue.status} />
          {urgent && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
              <Flame className="h-3 w-3" aria-hidden />
              Urgent
            </span>
          )}
          <span
            className={cn(
              "issue-title min-w-0 flex-1 truncate text-sm font-medium",
              done ? "text-muted-foreground line-through decoration-muted-foreground/50" : urgent ? "text-destructive" : "text-foreground/90",
            )}
          >
            {issue.title}
          </span>
          <span className="issue-unread-pill" aria-hidden="true">
            <span className="issue-unread-pill-dot" />
            New
          </span>
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
            {formatIssueNumber(issue)}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {formatDate(issue.due_at)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
            <MessageSquare className="h-3 w-3" aria-hidden />
            {issue.comment_count}
          </span>
        </div>

        {/* Line 2: created age · priority (non-urgent) · location · kind · labels · [spacer] · project · avatars */}
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
            {formatRelativeTime(issue.created_at, new Date())}
          </span>
          <span className="shrink-0 text-muted-foreground/40 text-[11px]" aria-hidden>·</span>
          {!urgent && issue.priority !== "normal" && issue.priority !== "low" && (
            <PriorityBadge priority={issue.priority} />
          )}
          {location && <LocationKindBadge kind={location.kind} name={location.name} />}
          <Badge variant="muted">{issue.kind.replaceAll("_", " ")}</Badge>
          {visibleLabels.slice(0, 2).map((label) => (
            <Badge key={label.id} variant="outline">{label.name}</Badge>
          ))}
          {labelOverflow > 0 && <Badge variant="outline">+{labelOverflow}</Badge>}
          <span className="flex-1" />
          <span className="max-w-[140px] shrink-0 truncate text-[11px] text-muted-foreground">
            {project?.title ?? "No project"}
          </span>
          <AvatarStack uids={issue.assignee_uids} usersById={userById} max={3} />
        </div>

        {actionText ? (
          <p
            className={cn(
              "mt-1 truncate text-[11px]",
              blocked ? "font-medium text-destructive/85" : "text-muted-foreground"
            )}
          >
            {blocked ? "Blocked: " : "Next: "}
            {actionText}
          </p>
        ) : null}

        {/* Comment preview: slides in on hover */}
        {hasPreview && (
          <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-out group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] motion-reduce:transition-none">
            <div className="min-h-0 overflow-hidden">
              <div className="issue-comment-glass mt-1.5 flex items-start gap-2 rounded-md px-3 py-2">
                <MessageSquare className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-foreground/80">
                      {issue.last_comment_author_name ?? "Someone"}
                    </span>
                    {issue.last_comment_at && (
                      <span className="text-[11px] text-muted-foreground/60">
                        {formatRelativeTime(issue.last_comment_at, new Date())}
                      </span>
                    )}
                    {issue.comment_count > 1 && (
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/50">
                        +{issue.comment_count - 1} more
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {issue.last_comment_preview}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Link>
    );
  }

  // Comfortable layout: 3-line card with full badges and activity summary
  return (
    <Link
      href={`/issues/${issue.id}`}
      className={cn(rowBase, "px-5 py-4")}
      data-issue-id={issue.id}
      data-updated-at={issue.updated_at.toMillis()}
    >
      {/* Line 1: status picker + priority badges */}
      <div className="flex flex-wrap items-center gap-2">
        <RowStatusPicker issueId={issue.id} currentStatus={issue.status} />
        <StatusBadge status={issue.status} showPulse />
        <PriorityBadge priority={issue.priority} prominent={urgent} />
        <span className="issue-unread-pill" aria-hidden="true">
          <span className="issue-unread-pill-dot" />
          New
        </span>
      </div>

      {/* Line 2: title + right meta */}
      <div className="mt-2.5 flex items-start gap-4">
        <h2
          className={cn(
            "issue-title min-w-0 flex-1 text-base font-medium leading-snug",
            urgent ? "text-destructive" : done ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {issue.title}{" "}
          <span className="font-mono text-xs font-normal text-muted-foreground">{formatIssueNumber(issue)}</span>
        </h2>
        <div className="hidden shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground sm:flex">
          <p className="tabular-nums">Due {formatDate(issue.due_at)}</p>
          <p className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            <span className="tabular-nums">{issue.comment_count}</span>
          </p>
        </div>
      </div>

      {/* Line 3: location · kind · labels · project · avatars · checklist */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {location && <LocationKindBadge kind={location.kind} name={location.name} />}
        <Badge variant="muted">{issue.kind.replaceAll("_", " ")}</Badge>
        {visibleLabels.slice(0, 2).map((label) => (
          <Badge key={label.id} variant="outline">{label.name}</Badge>
        ))}
        {labelOverflow > 0 && <Badge variant="outline">+{labelOverflow}</Badge>}
        <span className="text-sm text-muted-foreground">{project?.title ?? "No project"}</span>
        <AvatarStack uids={issue.assignee_uids} usersById={userById} max={3} />
        {issue.checklist_total > 0 && (
          <span className="text-xs text-muted-foreground">
            Checklist {issue.checklist_done}/{issue.checklist_total}
          </span>
        )}
      </div>

      {/* Line 4: last activity */}
      {actionText ? (
        <p
          className={cn(
            "mt-2 rounded-md border px-3 py-2 text-xs",
            blocked
              ? "border-destructive/20 bg-destructive/5 font-medium text-destructive/90"
              : "border-border/70 bg-secondary/35 text-muted-foreground"
          )}
        >
          {blocked ? "Blocked: " : "Next: "}
          {actionText}
        </p>
      ) : null}
      <p className="mt-1.5 text-xs text-muted-foreground">{issue.last_activity_summary}</p>
    </Link>
  );
}
