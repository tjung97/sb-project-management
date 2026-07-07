"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Clock,
  CornerDownRight,
  GitBranchPlus,
  Home,
  ListChecks,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { IssueWorkPanel, type PanelMode } from "@/src/components/issues/IssueWorkPanel";
import type { IssueTreeNode, IssueTreeStats } from "@/src/lib/ops/issue-tree";

// Drill-down column explorer (Miller columns): every depth is a full-size,
// vertically scrollable column. Pressing an issue slides its branch in from the
// right while ancestors stay on screen — no zooming, ever.

export function IssueExplorer({ roots, stats }: { roots: IssueTreeNode[]; stats: IssueTreeStats }) {
  // Selection path: path[0] is the selected root, path[1] its selected child, …
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  // Side work panel: discuss or branch an issue without leaving the map.
  const [panel, setPanel] = useState<{ issueId: string; mode: PanelMode } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { byId, parentOf } = useMemo(() => indexTree(roots), [roots]);

  // Column list derived from the selection path.
  const columns = useMemo(() => {
    const cols: Array<{ parent: IssueTreeNode | null; nodes: IssueTreeNode[] }> = [{ parent: null, nodes: roots }];
    for (const id of path) {
      const node = byId.get(id);
      if (!node) break;
      cols.push({ parent: node, nodes: node.children });
    }
    return cols;
  }, [roots, path, byId]);

  // Glide to the newest column when the path deepens.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const t = window.setTimeout(() => el.scrollTo({ left: el.scrollWidth, behavior: "smooth" }), 30);
    return () => window.clearTimeout(t);
  }, [path]);

  function select(depth: number, id: string) {
    setPath((prev) => (prev[depth] === id ? prev.slice(0, depth) : [...prev.slice(0, depth), id]));
  }

  // Search: pick a result → rebuild the path to it so its branch opens.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: IssueTreeNode[] = [];
    for (const node of byId.values()) {
      if (node.title.toLowerCase().includes(q) || (node.number != null && `#${node.number}`.includes(q))) hits.push(node);
      if (hits.length >= 12) break;
    }
    return hits;
  }, [byId, query]);

  function pathTo(id: string): string[] {
    const chain: string[] = [id];
    let cursor = parentOf.get(id) ?? null;
    while (cursor) {
      chain.unshift(cursor);
      cursor = parentOf.get(cursor) ?? null;
    }
    return chain;
  }

  function jumpTo(id: string) {
    setPath(pathTo(id));
    setQuery("");
  }

  function openPanel(issueId: string, mode: PanelMode) {
    setPanel({ issueId, mode });
  }

  const pct = Math.round(stats.progress * 100);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find an issue…"
            className="h-8 w-56 rounded-lg border border-border/80 bg-card pl-8 pr-7 text-xs outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
          {matches.length ? (
            <div className="absolute left-0 top-9 z-40 w-80 overflow-hidden rounded-lg border border-border/80 bg-popover shadow-lg">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => jumpTo(m.id)}
                  className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-left text-xs transition last:border-b-0 hover:bg-accent/50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_META[m.status]?.color }} />
                  {m.number != null ? <span className="shrink-0 tabular-nums text-muted-foreground">#{m.number}</span> : null}
                  <span className="min-w-0 truncate">{m.title}</span>
                  {m.children.length ? (
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{m.children.length} branches</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Legend */}
        <div className="hidden items-center gap-2.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-[10px] text-muted-foreground sm:flex">
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </span>
          ))}
        </div>

        {/* Overall completion */}
        <div className="ml-auto flex min-w-44 flex-1 items-center gap-2 sm:max-w-72">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {pct}% · {stats.done}/{stats.total} resolved
          </span>
        </div>
      </div>

      {/* Breadcrumb trail */}
      <div className="flex items-center gap-1 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setPath([])}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-2 py-1 transition",
            path.length === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Home className="h-3 w-3" />
          All issues
        </button>
        {path.map((id, i) => {
          const node = byId.get(id);
          if (!node) return null;
          const active = i === path.length - 1;
          return (
            <span key={id} className="flex shrink-0 items-center gap-1">
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <button
                type="button"
                onClick={() => setPath(path.slice(0, i + 1))}
                className={cn(
                  "max-w-44 truncate rounded-md px-2 py-1 transition",
                  active ? "bg-info/15 font-medium text-info" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                {node.title}
              </button>
            </span>
          );
        })}
      </div>

      {/* Columns + work panel */}
      <div className="flex min-h-0 flex-1 gap-3">
        <div
          ref={scrollerRef}
          className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden rounded-xl border border-border/80 bg-muted/20 p-3"
        >
          {columns.map((col, depth) => (
            <ExplorerColumn
              key={col.parent ? col.parent.id : "root"}
              parent={col.parent}
              nodes={col.nodes}
              selectedId={path[depth] ?? null}
              onSelect={(id) => select(depth, id)}
              onDiscuss={(id) => openPanel(id, "discuss")}
              onBranch={(id) => openPanel(id, "branch")}
              rootCount={stats.total}
            />
          ))}
        </div>

        {panel ? (
          <IssueWorkPanel
            key={panel.issueId}
            issueId={panel.issueId}
            mode={panel.mode}
            node={byId.get(panel.issueId) ?? null}
            onModeChange={(mode) => setPanel({ issueId: panel.issueId, mode })}
            onClose={() => setPanel(null)}
            onBranched={(parentId) => setPath(pathTo(parentId))}
          />
        ) : null}
      </div>
    </div>
  );
}

function ExplorerColumn({
  parent,
  nodes,
  selectedId,
  onSelect,
  onDiscuss,
  onBranch,
  rootCount,
}: {
  parent: IssueTreeNode | null;
  nodes: IssueTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDiscuss: (id: string) => void;
  onBranch: (id: string) => void;
  rootCount: number;
}) {
  return (
    <section className="icol flex h-full w-[300px] shrink-0 flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      {/* Column header */}
      <header className="border-b border-border/70 bg-muted/40 px-3 py-2">
        {parent ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <CornerDownRight className="h-3 w-3 shrink-0" />
                <span className="truncate">{parent.title}</span>
              </p>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {parent.subtreeDone}/{parent.subtreeCount}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div className="progress-fill h-full rounded-full" style={{ width: `${Math.round(parent.progress * 100)}%` }} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-muted-foreground">All issues</p>
            <span className="text-[10px] tabular-nums text-muted-foreground">{rootCount}</span>
          </div>
        )}
      </header>

      {/* Cards */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {nodes.length ? (
          nodes.map((node, i) => (
            <IssueCard
              key={node.id}
              node={node}
              active={selectedId === node.id}
              index={i}
              onSelect={() => onSelect(node.id)}
              onDiscuss={() => onDiscuss(node.id)}
              onBranch={() => onBranch(node.id)}
            />
          ))
        ) : parent ? (
          <BranchOutState parent={parent} onDiscuss={() => onDiscuss(parent.id)} onBranch={() => onBranch(parent.id)} />
        ) : (
          <p className="p-4 text-center text-xs text-muted-foreground">No issues yet.</p>
        )}
      </div>
    </section>
  );
}

function IssueCard({
  node,
  active,
  index,
  onSelect,
  onDiscuss,
  onBranch,
}: {
  node: IssueTreeNode;
  active: boolean;
  index: number;
  onSelect: () => void;
  onDiscuss: () => void;
  onBranch: () => void;
}) {
  const meta = STATUS_META[node.status] ?? STATUS_META.open;
  const hasChildren = node.children.length > 0;
  const branchComplete = hasChildren && node.progress >= 1;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      style={{ animationDelay: `${Math.min(index * 22, 330)}ms` }}
      className={cn(
        "icard group relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg border bg-background p-2 text-left",
        node.status === "blocked" && "icard--blocked",
        active ? "icard--active border-info/60 bg-info/5" : branchComplete ? "border-success/40" : "border-border/70 hover:border-foreground/25"
      )}
    >
      {/* status accent */}
      <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full" style={{ background: meta.color }} />

      <ProgressRing node={node} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {node.number != null ? <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">#{node.number}</span> : null}
          <span className="min-w-0 truncate text-xs font-semibold" title={node.title}>
            {node.title}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          {hasChildren ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 font-medium tabular-nums",
                branchComplete ? "icomplete-badge bg-success/15 text-success" : "bg-muted"
              )}
            >
              {node.subtreeDone}/{node.subtreeCount}
            </span>
          ) : null}
          {node.commentCount > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" />
              {node.commentCount}
            </span>
          ) : null}
          {node.checklistTotal > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <ListChecks className="h-2.5 w-2.5" />
              {node.checklistDone}/{node.checklistTotal}
            </span>
          ) : null}
          {node.overdue ? <span className="font-medium text-destructive">overdue</span> : null}
        </div>
      </div>

      {/* quick actions: open the side work panel without leaving the map */}
      <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDiscuss();
          }}
          title="Open discussion"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-info hover:text-info"
        >
          <MessageSquare className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBranch();
          }}
          title="Branch a sub-issue"
          className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition hover:border-info hover:text-info"
        >
          <GitBranchPlus className="h-3 w-3" />
        </button>
      </div>

      {/* branch indicator */}
      {hasChildren ? (
        <span
          className={cn(
            "flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border px-1 text-[10px] font-bold tabular-nums transition",
            active ? "border-info bg-info text-primary-foreground" : "border-info/40 text-info"
          )}
        >
          {node.children.length}
        </span>
      ) : (
        <ChevronRight
          className={cn("h-3.5 w-3.5 shrink-0 transition", active ? "text-info" : "text-muted-foreground/40")}
        />
      )}
    </div>
  );
}

/** Terminal column for a leaf: inspect it and branch it out — in the side panel. */
function BranchOutState({
  parent,
  onDiscuss,
  onBranch,
}: {
  parent: IssueTreeNode;
  onDiscuss: () => void;
  onBranch: () => void;
}) {
  const meta = STATUS_META[parent.status] ?? STATUS_META.open;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}
      >
        <meta.icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-semibold">{parent.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {meta.label}
          {parent.checklistTotal > 0 ? ` · checklist ${parent.checklistDone}/${parent.checklistTotal}` : ""} · no branches yet
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={onBranch}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
        >
          <GitBranchPlus className="h-3.5 w-3.5" />
          Branch a sub-issue
        </button>
        <button
          type="button"
          onClick={onDiscuss}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Open discussion
        </button>
      </div>
    </div>
  );
}

function ProgressRing({ node }: { node: IssueTreeNode }) {
  const meta = STATUS_META[node.status] ?? STATUS_META.open;
  const isParent = node.children.length > 0;
  const R = 16;
  const C = 2 * Math.PI * R;
  const ringColor =
    node.progress >= 1 ? "hsl(var(--success))" : node.status === "blocked" ? "hsl(var(--destructive))" : "hsl(var(--info))";

  return (
    <div className="relative h-10 w-10 shrink-0">
      <svg viewBox="0 0 40 40" className="tree-ring h-10 w-10 -rotate-90">
        <circle cx="20" cy="20" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
        <circle
          className="tree-ring-fg"
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={ringColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - node.progress)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {isParent ? (
          <span className={cn("text-[9px] font-bold tabular-nums", node.progress >= 1 ? "text-success" : "text-foreground")}>
            {Math.round(node.progress * 100)}%
          </span>
        ) : (
          <meta.icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
        )}
      </span>
    </div>
  );
}

function indexTree(roots: IssueTreeNode[]) {
  const byId = new Map<string, IssueTreeNode>();
  const parentOf = new Map<string, string | null>();
  const visit = (node: IssueTreeNode, parent: string | null) => {
    byId.set(node.id, node);
    parentOf.set(node.id, parent);
    for (const child of node.children) visit(child, node.id);
  };
  for (const root of roots) visit(root, null);
  return { byId, parentOf };
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Check }> = {
  open: { label: "Open", color: "hsl(var(--info))", icon: Circle },
  in_progress: { label: "In progress", color: "hsl(var(--warning))", icon: Clock },
  blocked: { label: "Blocked", color: "hsl(var(--destructive))", icon: AlertTriangle },
  done: { label: "Done", color: "hsl(var(--success))", icon: Check },
  closed: { label: "Closed", color: "hsl(var(--muted-foreground))", icon: Check },
};
