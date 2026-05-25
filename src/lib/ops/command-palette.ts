import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
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

const ACTION_COMMANDS: Omit<CommandPaletteItem, "icon">[] = [
  {
    id: "action-new-issue",
    kind: "action",
    label: "New issue",
    description: "Create a new issue",
    href: "/issues/new",
    keywords: ["open issue", "create issue", "add issue", "new", "compose"],
  },
];

export function commandPaletteItems(role: string): CommandPaletteItem[] {
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
    icon: Plus,
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
