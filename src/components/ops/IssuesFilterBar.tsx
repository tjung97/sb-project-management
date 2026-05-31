"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import {
  activeFilterChips,
  clearFilterKey,
  DUE_OPTIONS,
  filtersToSearchParams,
  hasActiveFilters,
  parseIssueFilters,
  STATUS_OPTIONS,
} from "@/src/lib/ops/issue-filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { cn } from "@/src/lib/utils";

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
] as const;

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

  function updateFilter(key: keyof ReturnType<typeof parseIssueFilters>, value: string | undefined) {
    navigate({ ...filters, [key]: value });
  }

  function clearFilter(key: string) {
    navigate(clearFilterKey(filters, key));
  }

  function resetAll() {
    navigate(parseIssueFilters({}));
  }

  // ── Compact: individual shadcn-style filter pills ──────────────────────────
  if (compact) {
    const activeStatus = filters.status && filters.status !== "openish" ? filters.status : undefined;
    const statusLabel = STATUS_OPTIONS.find((o) => o.value === activeStatus)?.label;
    const priorityLabel = PRIORITY_OPTIONS.find((o) => o.value === filters.priority)?.label;
    const assigneeLabel = users.find((u) => u.uid === filters.assignee)?.display_name;
    const locationLabel = locations.find((l) => l.id === filters.location)?.name;
    const projectLabel = projects.find((p) => p.id === filters.project)?.title;
    const dueLabel = filters.due ? DUE_OPTIONS.find((o) => o.value === filters.due)?.label : undefined;

    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", pending && "opacity-60")}>
        <FilterPill
          label="Status"
          value={activeStatus}
          activeLabel={statusLabel}
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => updateFilter("status", v)}
          onClear={() => clearFilter("status")}
        />
        <FilterPill
          label="Priority"
          value={filters.priority}
          activeLabel={priorityLabel}
          options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => updateFilter("priority", v)}
          onClear={() => clearFilter("priority")}
        />
        <FilterPill
          label="Assignee"
          value={filters.assignee}
          activeLabel={assigneeLabel}
          options={users.map((u) => ({ value: u.uid, label: u.display_name }))}
          onChange={(v) => updateFilter("assignee", v)}
          onClear={() => clearFilter("assignee")}
        />
        <FilterPill
          label="Location"
          value={filters.location}
          activeLabel={locationLabel}
          options={locations.map((l) => ({ value: l.id, label: l.name }))}
          onChange={(v) => updateFilter("location", v)}
          onClear={() => clearFilter("location")}
        />
        <FilterPill
          label="Project"
          value={filters.project}
          activeLabel={projectLabel}
          options={projects.map((p) => ({ value: p.id, label: p.title }))}
          onChange={(v) => updateFilter("project", v)}
          onClear={() => clearFilter("project")}
        />
        <FilterPill
          label="Due"
          value={filters.due}
          activeLabel={dueLabel}
          options={DUE_OPTIONS.filter((o) => o.value !== "").map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => updateFilter("due", v)}
          onClear={() => clearFilter("due")}
        />
        {active && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Reset
          </button>
        )}
      </div>
    );
  }

  // ── Full / embedded ────────────────────────────────────────────────────────
  const filterSelects = (
    <>
      <FilterSelect
        label="Status"
        value={filters.status ?? "openish"}
        options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => updateFilter("status", v)}
      />
      <FilterSelect
        label="Priority"
        value={filters.priority ?? "__empty__"}
        options={[
          { value: "__empty__", label: "Any priority" },
          ...PRIORITY_OPTIONS,
        ]}
        onChange={(v) => updateFilter("priority", v === "__empty__" ? undefined : v)}
      />
      <FilterSelect
        label="Assignee"
        value={filters.assignee ?? "__empty__"}
        options={[
          { value: "__empty__", label: "Any assignee" },
          ...users.map((u) => ({ value: u.uid, label: u.display_name })),
        ]}
        onChange={(v) => updateFilter("assignee", v === "__empty__" ? undefined : v)}
      />
      <FilterSelect
        label="Location"
        value={filters.location ?? "__empty__"}
        options={[
          { value: "__empty__", label: "Any location" },
          ...locations.map((l) => ({ value: l.id, label: l.name })),
        ]}
        onChange={(v) => updateFilter("location", v === "__empty__" ? undefined : v)}
      />
      <FilterSelect
        label="Project"
        value={filters.project ?? "__empty__"}
        options={[
          { value: "__empty__", label: "Any project" },
          ...projects.map((p) => ({ value: p.id, label: p.title })),
        ]}
        onChange={(v) => updateFilter("project", v === "__empty__" ? undefined : v)}
      />
      <FilterSelect
        label="Due"
        value={filters.due ?? "__empty__"}
        options={DUE_OPTIONS.map((o) => ({ value: o.value || "__empty__", label: o.label }))}
        onChange={(v) => updateFilter("due", v === "__empty__" ? undefined : v)}
      />
    </>
  );

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
        {active && (
          <button type="button" onClick={resetAll} className="text-xs font-medium text-primary hover:underline">
            Reset filters
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => navigate(clearFilterKey(filters, chip.key))}
              className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-foreground outline-none hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1"
            >
              {chip.label}
              <X className="h-3 w-3 opacity-70" aria-hidden />
            </button>
          ))}
        </div>
      )}

      <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6", embedded && "rounded-md border border-border/80 bg-background/60 p-2")}>
        {filterSelects}
      </div>
    </div>
  );
}

// ── Shadcn-style inline filter pill ───────────────────────────────────────────

function FilterPill({
  label,
  value,
  activeLabel,
  options,
  onChange,
  onClear,
}: {
  label: string;
  value: string | undefined;
  activeLabel: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const isActive = Boolean(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
            isActive
              ? "border-primary/35 bg-primary/[0.07] text-foreground hover:bg-primary/[0.11]"
              : "border-border/80 bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          {!isActive && <Plus className="h-3 w-3 shrink-0" aria-hidden />}
          <span>{label}</span>
          {isActive && activeLabel && (
            <>
              <span className="mx-0.5 h-3.5 w-px shrink-0 bg-border" aria-hidden />
              <span className="max-w-[7rem] truncate text-primary">{activeLabel}</span>
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-48 p-1">
        <div className="space-y-px">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
            >
              <Check
                className={cn("h-3.5 w-3.5 shrink-0", value === opt.value ? "opacity-100" : "opacity-0")}
                aria-hidden
              />
              {opt.label}
            </button>
          ))}
        </div>
        {isActive && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onClear}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Clear filter
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Full-form select (non-compact mode) ───────────────────────────────────────

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full text-sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={`${label}-${opt.value}`} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
