export interface SavedView {
  id: string;
  label: string;
  description: string;
  params: Record<string, string>;
}

export const SAVED_VIEWS: SavedView[] = [
  {
    id: "my-blocked",
    label: "My blocked",
    description: "Open issues assigned to you that are blocked",
    params: { status: "blocked", assignee: "__me__" },
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

