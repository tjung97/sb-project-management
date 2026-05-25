import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  FolderKanban,
  Inbox,
  Settings,
  Store,
  TestTube2,
  Warehouse,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in More menu and tooltips */
  description: string;
  adminOnly?: boolean;
};

export type AppNavGroup = {
  id: string;
  label: string;
  items: AppNavItem[];
};

export const NAV_GROUPS: AppNavGroup[] = [
  {
    id: "work",
    label: "Work",
    items: [
      {
        href: "/issues",
        label: "Issues",
        icon: ClipboardList,
        description: "Queue, filters, and location overview",
      },
      {
        href: "/inbox",
        label: "Inbox",
        icon: Inbox,
        description: "Assignments, mentions, and notifications",
      },
      {
        href: "/projects",
        label: "Projects",
        icon: FolderKanban,
        description: "Multi-day initiatives and linked work",
      },
    ],
  },
  {
    id: "places",
    label: "Places",
    items: [
      {
        href: "/stores",
        label: "Stores",
        icon: Store,
        description: "Front-of-house work by store",
      },
      {
        href: "/warehouse",
        label: "Warehouse",
        icon: Warehouse,
        description: "Supply, prep, and fulfillment",
      },
      {
        href: "/hq",
        label: "HQ",
        icon: Building2,
        description: "Cross-location leadership view",
      },
    ],
  },
];

export const NAV_MORE_ITEMS: AppNavItem[] = [
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    description: "Metrics and exports",
  },
  {
    href: "/hr",
    label: "People",
    icon: Briefcase,
    description: "Employee records and HR files",
    adminOnly: true,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    description: "Users, locations, labels, system health",
    adminOnly: true,
  },
  {
    href: "/pilot",
    label: "Pilot",
    icon: TestTube2,
    description: "Feedback and experiments",
  },
];

export function navItemsForRole(role: string) {
  const more = NAV_MORE_ITEMS.filter((item) => !item.adminOnly || role === "admin");
  return { groups: NAV_GROUPS, more };
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/issues") {
    return pathname === "/issues" || (pathname.startsWith("/issues/") && !pathname.startsWith("/issues/new"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavItem(pathname: string, role: string): AppNavItem | null {
  const { groups, more } = navItemsForRole(role);
  const all = [...groups.flatMap((g) => g.items), ...more];
  return all.find((item) => isNavActive(pathname, item.href)) ?? null;
}
