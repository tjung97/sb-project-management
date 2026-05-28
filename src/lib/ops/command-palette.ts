import type { LucideIcon } from "lucide-react";
import { Ban, CalendarClock, FolderPlus, Plus, UserX } from "lucide-react";
import { navItemsForRole } from "@/src/lib/ops/app-navigation";

export type CommandPaletteItem = {
  id: string;
  kind: "navigate" | "action";
  label: string;
  description?: string;
  href: string;
  keywords: string[];
  icon: LucideIcon;
  adminOnly?: boolean;
};

export type CommandPaletteSearchIssue = {
  id: string;
  title: string;
  issue_number: number | null;
  status: string;
};

export type CommandPaletteSearchProject = {
  id: string;
  title: string;
};

const ACTION_COMMANDS: CommandPaletteItem[] = [
  {
    id: "action-new-issue",
    kind: "action",
    label: "New issue",
    description: "Create a new issue",
    href: "/issues/new",
    keywords: ["open issue", "create issue", "add issue", "new", "compose"],
    icon: Plus,
  },
  {
    id: "action-new-project",
    kind: "action",
    label: "New project",
    description: "Create a new project",
    href: "/projects",
    keywords: ["create project", "add project", "new project", "initiative", "playbook"],
    icon: FolderPlus,
  },
  {
    id: "view-my-blocked",
    kind: "navigate",
    label: "My blocked",
    description: "Blocked issues assigned to you",
    href: "/issues?status=blocked&assignee=__me__",
    keywords: ["my blocked", "blocked assigned", "stuck"],
    icon: Ban,
  },
  {
    id: "view-due-week",
    kind: "navigate",
    label: "Due this week",
    description: "Open work due within seven days",
    href: "/issues?due=week",
    keywords: ["due this week", "upcoming", "deadline"],
    icon: CalendarClock,
  },
  {
    id: "view-needs-owner",
    kind: "navigate",
    label: "Needs owner",
    description: "Open work without an assignee",
    href: "/issues?unassigned=1",
    keywords: ["unassigned", "needs owner", "no owner"],
    icon: UserX,
  },
];

export function commandPaletteItems(role: string, userUid: string): CommandPaletteItem[] {
  const { groups, more } = navItemsForRole(role);
  const nav: CommandPaletteItem[] = [...groups.flatMap((g) => g.items), ...more].map((item) => ({
    id: `nav-${item.href}`,
    kind: "navigate" as const,
    label: item.label,
    description: item.description,
    href: item.href,
    keywords: [item.label.toLowerCase(), item.href.replace(/^\//, ""), item.description.toLowerCase()],
    icon: item.icon,
    adminOnly: item.adminOnly,
  }));

  const actions: CommandPaletteItem[] = ACTION_COMMANDS.map((item) => ({
    ...item,
    href: item.href.replace("__me__", userUid),
  }));

  return [...actions, ...nav];
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreItem(item: CommandPaletteItem, query: string) {
  if (!query) return 1;
  const label = item.label.toLowerCase();
  const haystack = [label, ...item.keywords.map((k) => k.toLowerCase()), item.description?.toLowerCase() ?? ""].join(" ");

  if (label === query) return 100;
  if (haystack.includes(query)) return 80;
  if (label.startsWith(query)) return 70;
  if (item.keywords.some((k) => k.toLowerCase().startsWith(query))) return 65;

  const tokens = query.split(" ").filter(Boolean);
  if (tokens.every((t) => haystack.includes(t))) return 50;

  return 0;
}

export function filterCommandItems(items: CommandPaletteItem[], query: string, limit = 8) {
  const q = normalizeQuery(query);
  if (!q) return items.slice(0, limit);

  return items
    .map((item) => ({ item, score: scoreItem(item, q) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map((row) => row.item);
}

export function shouldSearchRemote(query: string) {
  return normalizeQuery(query).length >= 2;
}
