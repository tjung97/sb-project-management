"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import {
  activeNavItem,
  isNavActive,
  navItemsForRole,
  type AppNavGroup,
  type AppNavItem,
} from "@/src/lib/ops/app-navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { cn } from "@/src/lib/utils";

export function MainNav({ role }: { role: string }) {
  const pathname = usePathname();
  const { groups, more } = navItemsForRole(role);
  const current = activeNavItem(pathname, role);
  const moreActive = more.some((item) => isNavActive(pathname, item.href));

  return (
    <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4" aria-label="Primary">
      {groups.map((group) => (
        <GroupNav key={group.id} group={group} pathname={pathname} />
      ))}

      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

      <MenuNav
        items={more}
        active={moreActive}
        pathname={pathname}
        label={moreActive && current ? current.label : "More"}
        icon={<MoreHorizontal className="h-4 w-4" />}
      />
    </nav>
  );
}

// A nav group: single-item groups render as a plain link; multi-item groups
// collapse into a dropdown that shows the current page as its label.
function GroupNav({ group, pathname }: { group: AppNavGroup; pathname: string }) {
  if (group.items.length === 1) {
    const item = group.items[0];
    return <NavLink item={item} active={isNavActive(pathname, item.href)} />;
  }

  const activeChild = group.items.find((item) => isNavActive(pathname, item.href));
  const Icon = activeChild?.icon;

  return (
    <MenuNav
      items={group.items}
      active={Boolean(activeChild)}
      pathname={pathname}
      label={activeChild ? activeChild.label : group.label}
      icon={Icon ? <Icon className="h-4 w-4" /> : undefined}
    />
  );
}

function NavLink({ item, active }: { item: AppNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={item.description}
      aria-current={active ? "page" : undefined}
      className={cn(
        "app-nav-link group relative flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
      <span className="whitespace-nowrap">{item.label}</span>
      {active ? <span className="app-nav-indicator" aria-hidden /> : null}
    </Link>
  );
}

// A dropdown trigger + rich item list, used by every multi-item group and "More".
function MenuNav({
  items,
  active,
  pathname,
  label,
  icon,
}: {
  items: AppNavItem[];
  active: boolean;
  pathname: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "app-nav-link relative flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          aria-haspopup="menu"
        >
          {icon ? <span className={active ? "text-foreground" : "text-muted-foreground"}>{icon}</span> : null}
          <span className="whitespace-nowrap">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          {active ? <span className="app-nav-indicator" aria-hidden /> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {items.map((item) => {
          const Icon = item.icon;
          const itemActive = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={itemActive ? "page" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                itemActive ? "bg-accent text-foreground" : "hover:bg-secondary/80"
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", itemActive ? "text-foreground" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.description}</span>
              </span>
            </Link>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
