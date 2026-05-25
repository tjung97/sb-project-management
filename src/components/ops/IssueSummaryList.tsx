import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/src/components/issues/IssueBadges";
import { formatDate, formatIssueNumber } from "@/src/lib/ops/format";
import type { IssueWithId } from "@/src/types/firestore";

export function IssueSummaryList({ issues, empty = "No issues." }: { issues: IssueWithId[]; empty?: string }) {
  if (issues.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="divide-y divide-border">
      {issues.map((issue) => (
        <Link key={issue.id} href={`/issues/${issue.id}`} className="block p-4 hover:bg-accent/40">
          <div className="mb-2 flex flex-wrap gap-2">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
          </div>
          <p className="font-medium">
            {issue.title} <span className="font-normal text-muted-foreground">{formatIssueNumber(issue)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Due {formatDate(issue.due_at)} · {issue.last_activity_summary}
          </p>
        </Link>
      ))}
    </div>
  );
}
