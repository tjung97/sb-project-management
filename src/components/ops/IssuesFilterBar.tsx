"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import {
  activeFilterChips,
  clearFilterKey,
  DUE_OPTIONS,
  filtersToSearchParams,
  hasActiveFilters,
  parseIssueFilters,
  STATUS_OPTIONS,
} from "@/src/lib/ops/issue-filters";
import { Button } from "@/src/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { cn } from "@/src/lib/utils";

const emptyValue = "__empty__";

export function IssuesFilterBar({
  users,
  locations,
  projects,
  embedded = false,
  compact = false,
}: {
  users: Array<{ uid: string; display_name: string }>;
  locations: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string }>;
  embedded?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const filters = parseIssueFilters(Object.fromEntries(searchParams.entries()));
  const chips = activeFilterChips(filters, { users, locations, projects });
  const active = hasActiveFilters(filters);

  function navigate(nextFilters: ReturnType<typeof parseIssueFilters>) {
    const params = filtersToSearchParams(nextFilters, { density: searchParams.get("density") ?? undefined });
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  function updateFilter(key: keyof ReturnType<typeof parseIssueFilters>, value: string) {
    const resolved = value === emptyValue ? undefined : value;
    navigate({ ...filters, [key]: resolved });
  }

  const filterSelects = (
    <>
      <FilterSelect
        label="Status"
        value={filters.status ?? "openish"}
        options={STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
        onChange={(value) => updateFilter("status", value)}
        compact={compact}
      />
      <FilterSelect
        label="Assignee"
        value={filters.assignee ?? emptyValue}
        options={[
          { value: emptyValue, label: "Any assignee" },
          ...users.map((user) => ({ value: user.uid, label: user.display_name })),
        ]}
        onChange={(value) => updateFilter("assignee", value)}
        compact={compact}
      />
      <FilterSelect
        label="Location"
        value={filters.location ?? emptyValue}
        options={[
          { value: emptyValue, label: "Any location" },
          ...locations.map((location) => ({ value: location.id, label: location.name })),
        ]}
        onChange={(value) => updateFilter("location", value)}
        compact={compact}
      />
      <FilterSelect
        label="Project"
        value={filters.project ?? emptyValue}
        options={[
          { value: emptyValue, label: "Any project" },
          ...projects.map((project) => ({ value: project.id, label: project.title })),
        ]}
        onChange={(value) => updateFilter("project", value)}
        compact={compact}
      />
      <FilterSelect
        label="Due"
        value={filters.due ?? emptyValue}
        options={DUE_OPTIONS.map((option) => ({ value: option.value || emptyValue, label: option.label }))}
        onChange={(value) => updateFilter("due", value)}
        compact={compact}
      />
    </>
  );

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 shrink-0 gap-1.5 px-2.5 text-xs",
              active && "border-primary/40 bg-primary/5",
              pending && "opacity-60"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Filters
            {active ? (
              <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold text-primary-foreground">
                {chips.length}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Filters</p>
            {active ? (
              <button
                type="button"
                onClick={() => navigate(parseIssueFilters({}))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Reset
              </button>
            ) : null}
          </div>
          {chips.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => navigate(clearFilterKey(filters, chip.key))}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring/45"
                >
                  {chip.label}
                  <X className="h-3 w-3 opacity-70" aria-hidden />
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">{filterSelects}</div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      className={cn(
        embedded ? "px-4 py-3" : "space-y-4 rounded-lg border bg-card p-5 shadow-card sm:p-6",
        active && !embedded && "border-primary/30",
        pending && "opacity-60"
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
        </span>
        {active ? (
          <button
            type="button"
            onClick={() => navigate(parseIssueFilters({}))}
            className="text-xs font-medium text-primary hover:underline"
          >
            Reset filters
          </button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => navigate(clearFilterKey(filters, chip.key))}
              className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1 hover:bg-primary/15"
            >
              {chip.label}
              <X className="h-3 w-3 opacity-70" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}

      <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-5", embedded && "rounded-md border border-border/80 bg-background/60 p-2")}>
        {filterSelects}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  compact,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label className={cn("font-medium text-muted-foreground", compact ? "text-[11px]" : "text-[11px]")}>{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className={cn("bg-background text-sm", compact ? "h-8 text-xs" : "h-9")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
