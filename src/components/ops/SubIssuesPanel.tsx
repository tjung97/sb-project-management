import Link from "next/link";
import { GitBranch } from "lucide-react";
import { StatusBadge } from "@/src/components/issues/IssueBadges";
import { formatIssueNumber } from "@/src/lib/ops/format";
import type { IssueWithId } from "@/src/types/firestore";

export function SubIssuesPanel({ parentIssueId, subIssues }: { parentIssueId: string; subIssues: IssueWithId[] }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="h-4 w-4" />
          Sub-issues
          {subIssues.length > 0 ? <span className="text-xs font-normal text-muted-foreground">({subIssues.length})</span> : null}
        </span>
        <Link href={`/issues/new?parent=${parentIssueId}`} className="text-xs font-medium text-primary hover:underline">
          Add
        </Link>
      </div>
      <div className="px-4 py-2">
        {subIssues.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">No linked sub-issues yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {subIssues.map((issue) => (
              <li key={issue.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/issues/${issue.id}`} className="truncate text-sm font-medium hover:underline">
                  {issue.title} <span className="font-normal text-muted-foreground">{formatIssueNumber(issue)}</span>
                </Link>
                <StatusBadge status={issue.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
