"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/src/lib/utils";

export function IssueDetailsMobileSummary({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn(className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mb-3 flex w-full items-center justify-between gap-2 border-b border-border pb-3 text-sm font-medium text-foreground lg:hidden"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden />
          Details &amp; people
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition", open && "rotate-180")} aria-hidden />
      </button>
      <div className={cn(!open && "hidden", "lg:block")}>{children}</div>
    </div>
  );
}
