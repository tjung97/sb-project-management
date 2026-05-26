"use client";

import { createPortal } from "react-dom";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { IssuesSearchBar } from "@/src/components/ops/IssuesSearchBar";
import { SavedViewsBar } from "@/src/components/ops/SavedViewsBar";
import { useIssuesToolbarRoot } from "@/src/components/ops/IssuesToolbarRoot";
import { cn } from "@/src/lib/utils";

export function IssuesQueueControls({
  resultCount,
  defaultQuery,
  userUid,
  activeFilters,
}: {
  resultCount: number;
  defaultQuery: string;
  userUid: string | null;
  activeFilters: boolean;
}) {
  const pathname = usePathname();
  const toolbarRoot = useIssuesToolbarRoot();

  if (pathname !== "/issues" || !toolbarRoot) {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "mx-auto max-w-7xl px-4 py-2",
        activeFilters && "bg-primary/[0.03]"
      )}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <Suspense fallback={<div className="h-8 flex-1 animate-pulse rounded-md bg-secondary" />}>
          <IssuesSearchBar compact defaultQuery={defaultQuery} resultCount={resultCount} />
        </Suspense>

        <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-[55%]">
          <Suspense fallback={<div className="h-7 min-w-[8rem] flex-1 animate-pulse rounded-md bg-secondary" />}>
            <SavedViewsBar compact userUid={userUid} />
          </Suspense>
        </div>
      </div>
    </div>,
    toolbarRoot
  );
}
