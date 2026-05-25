"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Soup } from "lucide-react";
import { MainNav } from "@/src/components/layout/MainNav";
import { IssuesToolbarRoot } from "@/src/components/ops/IssuesToolbarRoot";
import { RoleBadge } from "@/src/components/ops/RoleBadge";
import { SignOutButton } from "@/src/components/SignOutButton";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { useCommandPalette } from "@/src/components/command/CommandPaletteProvider";
import { useIssueHeader } from "@/src/components/issues/IssueHeaderContext";
import { AppShellIssueContext } from "@/src/components/layout/AppShellIssueContext";
import { useAppShellHeaderMetrics } from "@/src/hooks/useAppShellHeaderMetrics";
import { useHeaderGlass } from "@/src/hooks/useHeaderGlass";
import { activeNavItem } from "@/src/lib/ops/app-navigation";
import type { AuthUser } from "@/src/lib/firebase/auth-server";
import { cn } from "@/src/lib/utils";

export function AppShellHeader({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const current = activeNavItem(pathname, user.role);
  const glass = useHeaderGlass();
  const { setOpen: setCommandOpen } = useCommandPalette();
  const { state: issueHeader } = useIssueHeader();
  const headerRef = useRef<HTMLElement>(null);
  useAppShellHeaderMetrics(headerRef, [glass, pathname]);

  const isIssueDetail =
    pathname.startsWith("/issues/") && !pathname.startsWith("/issues/new");
  const issueContextActive = Boolean(isIssueDetail && issueHeader?.compact);

  return (
    <header
      ref={headerRef}
      className={cn("app-shell-header sticky top-0 z-20", glass && "app-shell-header--glass")}
      data-glass={glass ? "true" : "false"}
      data-issue-context={issueContextActive ? "true" : "false"}
    >
      <div className={cn("app-shell-header-panel", glass && "app-shell-glass-surface")}>
        <div className="app-shell-brand-row">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5">
            <Link
              href="/issues"
              className="group flex min-w-0 items-center gap-2.5 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/45"
              title="Seoul Bowl Operations — go to Issues"
            >
              <span
                className={cn(
                  "app-shell-logo-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition group-hover:bg-secondary",
                  glass ? "border-white/25 bg-white/15 dark:border-white/10 dark:bg-white/8" : "border-border bg-secondary/60 group-hover:bg-secondary"
                )}
              >
                <Soup className="h-4 w-4 text-foreground" aria-hidden />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold tracking-tight">Seoul Bowl</span>
                <span className="block truncate text-[11px] text-muted-foreground">Operations</span>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              {current ? (
                <p className="hidden max-w-[12rem] truncate text-xs text-muted-foreground md:block" title={current.description}>
                  {current.description}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden items-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 md:inline-flex"
                aria-label="Open command palette"
              >
                <span>Search</span>
                <kbd className="rounded border border-border/80 bg-background/80 px-1 font-sans text-[10px]">⌘K</kbd>
              </button>
              <ThemeToggle />
              <div
                className={cn(
                  "app-shell-user-divider hidden items-center gap-2 border-l pl-2 sm:flex",
                  glass ? "border-white/0" : "border-border/80"
                )}
              >
                <div className="text-right text-xs">
                  <p className="max-w-[10rem] truncate font-medium text-foreground">{user.name ?? user.email ?? "Team member"}</p>
                  {user.storeIds.length > 0 ? (
                    <p className="max-w-[10rem] truncate text-muted-foreground">
                      {user.storeIds.length === 1 ? "1 store" : `${user.storeIds.length} stores`}
                    </p>
                  ) : null}
                </div>
                <RoleBadge role={user.role} />
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>

        <div className="app-shell-nav-row">
          <div className="mx-auto flex max-w-7xl items-center overflow-x-auto px-4 py-1.5">
            <MainNav role={user.role} />
          </div>
        </div>

        <AppShellIssueContext />

        <IssuesToolbarRoot className="app-shell-issues-toolbar" />
      </div>
    </header>
  );
}
