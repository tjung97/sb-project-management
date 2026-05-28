export interface SavedView {
  id: string;
  label: string;
  description: string;
  params: Record<string, string>;
}

export const SAVED_VIEWS: SavedView[] = [
  {
    id: "my-work",
    label: "My open work",
    description: "All open issues assigned to you",
    params: { status: "openish", assignee: "__me__" },
  },
  {
    id: "my-blocked",
    label: "My blocked",
    description: "Open issues assigned to you that are blocked",
    params: { status: "blocked", assignee: "__me__" },
  },
  {
    id: "my-due-week",
    label: "My due this week",
    description: "Open issues assigned to you and due within seven days",
    params: { status: "openish", assignee: "__me__", due: "week" },
  },
  {
    id: "urgent-store",
    label: "Urgent store work",
    description: "Urgent priority at store locations",
    params: { status: "openish", priority: "urgent" },
  },
  {
    id: "unassigned-hq",
    label: "Unassigned HQ",
    description: "HQ/global work without an assignee",
    params: { status: "openish", location: "hq", unassigned: "1" },
  },
  {
    id: "warehouse-blocked",
    label: "Warehouse blocked",
    description: "Blocked warehouse and supply issues",
    params: { status: "blocked", location: "warehouse" },
  },
  {
    id: "due-this-week",
    label: "Due this week",
    description: "Open work due within seven days",
    params: { status: "openish", due: "week" },
  },
  {
    id: "needs-owner",
    label: "Needs owner",
    description: "Open work without an assignee",
    params: { status: "openish", unassigned: "1" },
  },
  {
    id: "blocked-72h",
    label: "Blocked 72h+",
    description: "Blocked issues that have not moved in 72 hours",
    params: { status: "blocked", stale: "blocked_72h" },
  },
  {
    id: "recently-updated",
    label: "Recently updated",
    description: "Newest open work across your scope",
    params: { status: "openish" },
  },
];

export function savedViewHref(view: SavedView, userUid: string | null) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(view.params)) {
    if (value === "__me__" && userUid) params.set(key, userUid);
    else if (key === "unassigned") params.set("unassigned", "1");
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `/issues?${query}` : "/issues";
}
