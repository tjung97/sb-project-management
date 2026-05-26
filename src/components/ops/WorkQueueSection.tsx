"use client";

import { useState, Suspense } from "react";
import { ChevronDown } from "lucide-react";
import { IssuesFilterBar } from "@/src/components/ops/IssuesFilterBar";
import { cn } from "@/src/lib/utils";

export function WorkQueueSection({
  issueCount,
  activeFilters,
  users,
  locations,
  projects,
  children,
}: {
  issueCount: number;
  activeFilters: boolean;
  users: Array<{ uid: string; display_name: string }>;
  locations: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string }>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold hover:text-foreground/80 transition-colors"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150", !open && "-rotate-90")}
            aria-hidden
          />
          Work queue
          <span className="font-normal text-muted-foreground">
            ({issueCount} issue{issueCount === 1 ? "" : "s"}
            {activeFilters ? ", filtered" : ""})
          </span>
        </button>

        <Suspense>
          <IssuesFilterBar compact users={users} locations={locations} projects={projects} />
        </Suspense>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
