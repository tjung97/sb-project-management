import type { IssueFilters } from "@/src/lib/ops/data";
import { SAVED_VIEWS, type SavedView } from "@/src/lib/ops/saved-views";

export const DEFAULT_ISSUE_STATUS = "openish";

export const STATUS_OPTIONS = [
  { value: "openish", label: "Open work" },
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "closed", label: "Closed" },
] as const;

export const DUE_OPTIONS = [
  { value: "", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "none", label: "No due date" },
] as const;

export function parseIssueFilters(params: Record<string, string | string[] | undefined>): IssueFilters {
  return {
    status: (one(params.status) as IssueFilters["status"]) ?? DEFAULT_ISSUE_STATUS,
    assignee: one(params.assignee),
    watcher: one(params.watcher),
    location: one(params.location),
    project: one(params.project),
    priority: one(params.priority) as IssueFilters["priority"],
    label: one(params.label),
    due: one(params.due) as IssueFilters["due"],
    stale: one(params.stale) as IssueFilters["stale"],
    q: one(params.q),
    unassigned: one(params.unassigned) === "1",
  };
}

export function filtersToSearchParams(filters: IssueFilters, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== DEFAULT_ISSUE_STATUS) params.set("status", filters.status);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.unassigned) params.set("unassigned", "1");
  if (filters.location) params.set("location", filters.location);
  if (filters.project) params.set("project", filters.project);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.label) params.set("label", filters.label);
  if (filters.due) params.set("due", filters.due);
  if (filters.stale) params.set("stale", filters.stale);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (extra?.density) params.set("density", extra.density);
  return params;
}

export function issuesHref(filters: IssueFilters, extra?: Record<string, string | undefined>) {
  const params = filtersToSearchParams(filters, extra);
  const query = params.toString();
  return query ? `/issues?${query}` : "/issues";
}

export function hasActiveFilters(filters: IssueFilters) {
  return (
    (filters.status && filters.status !== DEFAULT_ISSUE_STATUS) ||
    Boolean(filters.assignee) ||
    Boolean(filters.unassigned) ||
    Boolean(filters.location) ||
    Boolean(filters.project) ||
    Boolean(filters.priority) ||
    Boolean(filters.label) ||
    Boolean(filters.due) ||
    Boolean(filters.stale) ||
    Boolean(filters.q?.trim())
  );
}

export interface ActiveFilterChip {
  key: string;
  label: string;
}

export function activeFilterChips(
  filters: IssueFilters,
  lookups: {
    users: Array<{ uid: string; display_name: string }>;
    locations: Array<{ id: string; name: string }>;
    projects: Array<{ id: string; title: string }>;
  }
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.status && filters.status !== DEFAULT_ISSUE_STATUS) {
    const label = STATUS_OPTIONS.find((option) => option.value === filters.status)?.label ?? filters.status;
    chips.push({ key: "status", label: `Status: ${label}` });
  }
  if (filters.unassigned) chips.push({ key: "unassigned", label: "Unassigned only" });
  if (filters.assignee) {
    const user = lookups.users.find((item) => item.uid === filters.assignee);
    chips.push({ key: "assignee", label: `Assignee: ${user?.display_name ?? "Unknown"}` });
  }
  if (filters.location) {
    const location = lookups.locations.find((item) => item.id === filters.location);
    chips.push({ key: "location", label: `Location: ${location?.name ?? filters.location}` });
  }
  if (filters.project) {
    const project = lookups.projects.find((item) => item.id === filters.project);
    chips.push({ key: "project", label: `Project: ${project?.title ?? filters.project}` });
  }
  if (filters.priority) chips.push({ key: "priority", label: `Priority: ${filters.priority}` });
  if (filters.due) {
    const label = DUE_OPTIONS.find((option) => option.value === filters.due)?.label ?? filters.due;
    chips.push({ key: "due", label: `Due: ${label}` });
  }
  if (filters.stale === "blocked_72h") chips.push({ key: "stale", label: "Blocked 72h+" });
  if (filters.stale === "unassigned_48h") chips.push({ key: "stale", label: "Unassigned 48h+" });
  if (filters.q?.trim()) chips.push({ key: "q", label: `Search: ${filters.q.trim()}` });
  return chips;
}

export function clearFilterKey(filters: IssueFilters, key: string): IssueFilters {
  const next = { ...filters };
  switch (key) {
    case "status":
      next.status = DEFAULT_ISSUE_STATUS;
      break;
    case "unassigned":
      next.unassigned = false;
      break;
    case "assignee":
      next.assignee = undefined;
      break;
    case "location":
      next.location = undefined;
      break;
    case "project":
      next.project = undefined;
      break;
    case "priority":
      next.priority = undefined;
      break;
    case "due":
      next.due = undefined;
      break;
    case "stale":
      next.stale = undefined;
      break;
    case "q":
      next.q = undefined;
      break;
    default:
      break;
  }
  return next;
}

export function savedViewParams(view: SavedView, userUid: string | null) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(view.params)) {
    if (value === "__me__" && userUid) params.set("assignee", userUid);
    else if (key === "unassigned") params.set("unassigned", "1");
    else params.set(key, value);
  }
  return params;
}

export function matchesSavedView(
  current: Record<string, string | string[] | undefined>,
  view: SavedView,
  userUid: string | null
) {
  if (one(current.q)) return false;
  const expected = savedViewParams(view, userUid);
  for (const [key, value] of expected.entries()) {
    if (one(current[key]) !== value) return false;
  }
  const currentKeys = ["status", "assignee", "unassigned", "location", "project", "priority", "due", "stale"];
  for (const key of currentKeys) {
    if (!expected.has(key) && one(current[key])) return false;
  }
  return true;
}

export function activeSavedViewId(
  current: Record<string, string | string[] | undefined>,
  userUid: string | null
) {
  return SAVED_VIEWS.find((view) => matchesSavedView(current, view, userUid))?.id ?? null;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
