import Link from "next/link";
import { Ban } from "lucide-react";

export function BlockedWorkflowBanner({
  blockedReason,
  nextStep,
}: {
  blockedReason: string | null;
  nextStep: string | null;
}) {
  const hasContent = Boolean(blockedReason?.trim() || nextStep?.trim());

  return (
    <div
      className="rounded-lg border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm"
      role="status"
    >
      <div className="flex flex-wrap items-start gap-3">
        <Ban className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-destructive">This issue is blocked</p>
          {hasContent ? (
            <dl className="space-y-1 text-foreground/90">
              {blockedReason?.trim() ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</dt>
                  <dd>{blockedReason.trim()}</dd>
                </div>
              ) : null}
              {nextStep?.trim() ? (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next step</dt>
                  <dd>{nextStep.trim()}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="text-muted-foreground">Add a blocked reason and next step in Details.</p>
          )}
        </div>
        <Link
          href="#issue-details"
          className="shrink-0 text-xs font-medium text-primary hover:underline"
        >
          Edit in Details
        </Link>
      </div>
    </div>
  );
}
