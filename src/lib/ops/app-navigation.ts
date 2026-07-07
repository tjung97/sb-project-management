import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarRange,
  ClipboardList,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Network,
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
    id: "overview",
    label: "Overview",
    items: [
      {
        href: "/",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Live overview of work, sales, labor, and store ops",
      },
    ],
  },
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
        href: "/issues/tree",
        label: "Issue map",
        icon: Network,
        description: "Branching map of issues with live progress",
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
    id: "operations",
    label: "Operations",
    items: [
      {
        href: "/operations",
        label: "Store monitor",
        icon: MessagesSquare,
        description: "Sling chat activity and daily checklist compliance",
      },
      {
        href: "/operations/schedule",
        label: "Schedule",
        icon: CalendarRange,
        description: "This week and next week store scheduling from Sling",
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
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/issues") {
    return (
      pathname === "/issues" ||
      (pathname.startsWith("/issues/") && !pathname.startsWith("/issues/new") && !pathname.startsWith("/issues/tree"))
    );
  }
  // Store monitor lives at /operations; its sibling /operations/schedule is a
  // separate nav item, so only match the monitor on its exact path.
  if (href === "/operations") {
    return pathname === "/operations";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavItem(pathname: string, role: string): AppNavItem | null {
  const { groups, more } = navItemsForRole(role);
  const all = [...groups.flatMap((g) => g.items), ...more];
  return all.find((item) => isNavActive(pathname, item.href)) ?? null;
}
