"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { activeSavedViewId, savedViewParams } from "@/src/lib/ops/issue-filters";
import { SAVED_VIEWS } from "@/src/lib/ops/saved-views";
import { cn } from "@/src/lib/utils";

export function SavedViewsBar({ userUid, compact = false }: { userUid: string | null; compact?: boolean }) {
  const searchParams = useSearchParams();
  const current = Object.fromEntries(searchParams.entries());
  const activeId = activeSavedViewId(current, userUid);

  return (
    <div className={cn("flex min-w-0 items-center", compact ? "flex-1" : "gap-2")}>
      {!compact ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">Views</span>
      ) : null}
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-px [scrollbar-width:thin]">
        {SAVED_VIEWS.map((view) => {
          const params = savedViewParams(view, userUid);
          const href = params.toString() ? `/issues?${params.toString()}` : "/issues";
          const active = activeId === view.id;
          return (
            <Link
              key={view.id}
              href={href}
              title={view.description}
              className={cn(
                "inline-flex shrink-0 items-center rounded-md border font-medium transition outline-none",
                "focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                compact ? "px-2 py-1 text-[11px]" : "rounded-full px-3 py-1 text-xs",
                active
                  ? "border-primary/50 bg-primary text-primary-foreground shadow-sm"
                  : "border-border/80 bg-background text-foreground hover:border-border hover:bg-accent/50"
              )}
            >
              {view.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
