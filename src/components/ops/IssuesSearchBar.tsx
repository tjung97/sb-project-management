"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Search, X } from "lucide-react";
import { parseIssueFilters, filtersToSearchParams, hasActiveFilters } from "@/src/lib/ops/issue-filters";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";

export function IssuesSearchBar({
  defaultQuery,
  resultCount,
  compact = false,
}: {
  defaultQuery: string;
  resultCount: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const filters = parseIssueFilters(Object.fromEntries(searchParams.entries()));
  const hasQuery = Boolean(defaultQuery.trim());
  const active = hasActiveFilters(filters);

  function applySearch(query: string) {
    const next = { ...filters, q: query.trim() || undefined };
    const params = filtersToSearchParams(next, { density: searchParams.get("density") ?? undefined });
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  function clearAll() {
    const density = searchParams.get("density") ?? undefined;
    const params = filtersToSearchParams(parseIssueFilters({}), { density });
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  return (
    <form
      className={cn("flex min-w-0 items-center gap-2", compact ? "flex-1 lg:max-w-md" : "flex-col sm:flex-row sm:items-center")}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        applySearch(String(formData.get("q") ?? ""));
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className={cn(
            "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground",
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          )}
        />
        <Input
          name="q"
          defaultValue={defaultQuery}
          placeholder={compact ? "Search issues…" : "Search title, #42, assignee, location…"}
          className={cn("bg-background pl-8 pr-8", compact ? "h-8 text-xs" : "h-9 pl-9 pr-9")}
          aria-label="Search issues"
        />
        {hasQuery ? (
          <button
            type="button"
            onClick={() => applySearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring/45 hover:bg-accent hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-md border border-border/80 bg-background tabular-nums text-muted-foreground",
          compact ? "h-8 px-2 text-[11px]" : "h-9 px-2.5 text-xs",
          pending && "opacity-60"
        )}
      >
        <span className="font-semibold text-foreground">{resultCount}</span>
        <span className="ml-1">{hasQuery ? `match${resultCount === 1 ? "" : "es"}` : "in queue"}</span>
      </span>
      {active ? (
        <button
          type="button"
          onClick={clearAll}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-background text-muted-foreground transition hover:bg-accent/50 hover:text-foreground",
            compact ? "h-8 px-2 text-[11px]" : "h-9 px-2.5 text-xs"
          )}
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Clear
        </button>
      ) : null}
    </form>
  );
}
