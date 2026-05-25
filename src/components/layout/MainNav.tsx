"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { activeNavItem, isNavActive, navItemsForRole, type AppNavItem } from "@/src/lib/ops/app-navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { cn } from "@/src/lib/utils";

export function MainNav({ role }: { role: string }) {
  const pathname = usePathname();
  const { groups, more } = navItemsForRole(role);
  const current = activeNavItem(pathname, role);
  const moreActive = more.some((item) => isNavActive(pathname, item.href));

  return (
    <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4" aria-label="Primary">
      {groups.map((group, groupIndex) => (
        <div key={group.id} className="flex items-center">
          {groupIndex > 0 ? <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden /> : null}
          <span className="mr-1.5 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 lg:inline">
            {group.label}
          </span>
          <div className="flex items-center gap-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} />
            ))}
          </div>
        </div>
      ))}

      <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />

      <MoreNav items={more} active={moreActive} pathname={pathname} currentLabel={current?.label} />
    </nav>
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

function MoreNav({
  items,
  active,
  pathname,
  currentLabel,
}: {
  items: AppNavItem[];
  active: boolean;
  pathname: string;
  currentLabel?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "app-nav-link relative flex items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          aria-expanded={undefined}
          aria-haspopup="menu"
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>{active && currentLabel ? currentLabel : "More"}</span>
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
              className={cn(
                "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                itemActive ? "bg-accent text-foreground" : "hover:bg-secondary/80"
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
