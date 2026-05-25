"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ClipboardList, FolderKanban, Loader2, Search } from "lucide-react";
import {
  commandPaletteItems,
  filterCommandItems,
  shouldSearchRemote,
  type CommandPaletteItem,
  type CommandPaletteSearchIssue,
  type CommandPaletteSearchProject,
} from "@/src/lib/ops/command-palette";
import { cn } from "@/src/lib/utils";

type Row =
  | { type: "command"; item: CommandPaletteItem }
  | { type: "issue"; item: CommandPaletteSearchIssue }
  | { type: "project"; item: CommandPaletteSearchProject };

export function CommandPalette({ onOpenChange, role }: { onOpenChange: (open: boolean) => void; role: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [remoteIssues, setRemoteIssues] = useState<CommandPaletteSearchIssue[]>([]);
  const [remoteProjects, setRemoteProjects] = useState<CommandPaletteSearchProject[]>([]);
  const [searching, setSearching] = useState(false);

  const allCommands = useMemo(() => commandPaletteItems(role), [role]);
  const commands = useMemo(() => filterCommandItems(allCommands, query, 10), [allCommands, query]);
  const remoteSearch = shouldSearchRemote(query);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!remoteSearch) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/command-palette?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          issues: CommandPaletteSearchIssue[];
          projects: CommandPaletteSearchProject[];
        };
        setRemoteIssues(data.issues);
        setRemoteProjects(data.projects);
      } catch {
        if (!controller.signal.aborted) {
          setRemoteIssues([]);
          setRemoteProjects([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, remoteSearch]);

  const rows: Row[] = useMemo(() => {
    const list: Row[] = commands.map((item) => ({ type: "command", item }));
    if (remoteSearch) {
      for (const item of remoteIssues) list.push({ type: "issue", item });
      for (const item of remoteProjects) list.push({ type: "project", item });
    }
    return list;
  }, [commands, remoteSearch, remoteIssues, remoteProjects]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const runRow = useCallback(
    (row: Row) => {
      onOpenChange(false);
      if (row.type === "command") router.push(row.item.href);
      else if (row.type === "issue") router.push(`/issues/${row.item.id}`);
      else router.push(`/projects/${row.item.id}`);
    },
    [onOpenChange, router]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (event.key === "Enter" && rows[activeIndex]) {
      event.preventDefault();
      runRow(rows[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
  };

  let section: "command" | "issue" | "project" | null = null;

  return (
    <div className="command-palette-root" role="presentation">
      <button
        type="button"
        className="command-palette-backdrop"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="command-palette-panel app-shell-glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <div className="command-palette-input-wrap">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Go somewhere, run an action, or search issues and projects…"
            className="command-palette-input"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls="command-palette-list"
          />
          {searching && remoteSearch ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
          <kbd className="command-palette-kbd hidden sm:inline-flex">esc</kbd>
        </div>

        <div ref={listRef} id="command-palette-list" className="command-palette-list" role="listbox">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {query.trim().length < 2
                ? "Try “issues”, “open issue”, “inbox”, or type 2+ characters to search."
                : "No matches. Try a different phrase."}
            </p>
          ) : (
            rows.map((row, index) => {
              const showHeading = row.type !== section;
              section = row.type;
              const active = index === activeIndex;

              return (
                <div key={rowKey(row)}>
                  {showHeading ? (
                    <p className="command-palette-section-label">
                      {row.type === "command" ? "Go & do" : row.type === "issue" ? "Issues" : "Projects"}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-active={active ? "true" : undefined}
                    className={cn("command-palette-row group", active && "command-palette-row--active")}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runRow(row)}
                  >
                    <RowIcon row={row} />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium">{rowLabel(row)}</span>
                      {rowDescription(row) ? (
                        <span className="block truncate text-xs text-muted-foreground">{rowDescription(row)}</span>
                      ) : null}
                    </span>
                    <ArrowRight className="command-palette-row-chevron h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <footer className="command-palette-footer">
          <span>
            <kbd className="command-palette-kbd">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="command-palette-kbd">↵</kbd> open
          </span>
          <span className="hidden sm:inline">
            <kbd className="command-palette-kbd">⌘K</kbd> anywhere
          </span>
        </footer>
      </div>
    </div>
  );
}

function rowKey(row: Row) {
  if (row.type === "command") return row.item.id;
  if (row.type === "issue") return `issue-${row.item.id}`;
  return `project-${row.item.id}`;
}

function rowLabel(row: Row) {
  if (row.type === "command") return row.item.label;
  if (row.type === "issue") {
    const num = row.item.issue_number != null ? `#${row.item.issue_number} · ` : "";
    return `${num}${row.item.title}`;
  }
  return row.item.title;
}

function rowDescription(row: Row) {
  if (row.type === "command") return row.item.description;
  if (row.type === "issue") return row.item.status.replace(/_/g, " ");
  return "Project";
}

function RowIcon({ row }: { row: Row }) {
  if (row.type === "command") {
    const Icon = row.item.icon;
    return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (row.type === "issue") {
    return <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}
