"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PriorityBadge } from "@/src/components/issues/IssueBadges";
import { StatusIndicator } from "@/src/components/issues/StatusIndicator";
import { useIssueHeader } from "@/src/components/issues/IssueHeaderContext";
import { cn } from "@/src/lib/utils";

function isIssueDetailPath(pathname: string) {
  return pathname.startsWith("/issues/") && !pathname.startsWith("/issues/new");
}

export function AppShellIssueContext() {
  const pathname = usePathname();
  const { state } = useIssueHeader();

  if (!isIssueDetailPath(pathname) || !state) {
    return null;
  }

  const showPriorityPill = state.priority === "urgent" || state.priority === "high";

  return (
    <div
      className={cn("app-shell-issue-context", state.compact && "app-shell-issue-context--open")}
      data-issue-context={state.compact ? "true" : "false"}
    >
      <div className="app-shell-issue-context-inner">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link
            href="/issues"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Issues</span>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">
              {state.title}{" "}
              <span className="font-mono text-xs font-normal text-muted-foreground">{state.issueNumber}</span>
            </p>
          </div>

          <StatusIndicator status={state.status} showPulse className="shrink-0" />

          {showPriorityPill ? (
            <PriorityBadge priority={state.priority} prominent={state.priorityProminent} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
