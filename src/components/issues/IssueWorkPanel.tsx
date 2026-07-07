"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, GitBranchPlus, ListChecks, Loader2, MessageSquare, Send, X } from "lucide-react";
import { addIssueComment, createIssue, updateIssueStatus } from "@/src/lib/ops/actions";
import { ISSUE_KINDS, ISSUE_PRIORITIES, ISSUE_STATUSES } from "@/src/lib/ops/constants";
import { cn } from "@/src/lib/utils";
import type { IssueTreeNode } from "@/src/lib/ops/issue-tree";

export type PanelMode = "discuss" | "branch";

interface PanelIssue {
  id: string;
  number: number | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  kind: string;
  checklistTotal: number;
  checklistDone: number;
  dueMs: number | null;
}

interface PanelComment {
  id: string;
  body: string;
  authorName: string;
  createdMs: number | null;
  attachments: Array<{ name: string; url: string; kind: string }>;
}

// Slide-in side panel for working on an issue without leaving the map. Every
// mutation runs the app's existing server actions, then router.refresh() so the
// tree columns re-derive from fresh data while local state (path, panel) stays.
export function IssueWorkPanel({
  issueId,
  mode,
  node,
  onModeChange,
  onClose,
  onBranched,
}: {
  issueId: string;
  mode: PanelMode;
  node: IssueTreeNode | null;
  onModeChange: (mode: PanelMode) => void;
  onClose: () => void;
  onBranched: (parentId: string) => void;
}) {
  const router = useRouter();
  const [issue, setIssue] = useState<PanelIssue | null>(null);
  const [comments, setComments] = useState<PanelComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The panel is remounted per issue (key={issueId} at the call site), so the
  // initial loading state is already fresh — the effect only fetches.
  useEffect(() => {
    const controller = new AbortController();
    fetchPanel(issueId, controller.signal)
      .then((data) => {
        setIssue(data.issue);
        setComments(data.comments);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load issue.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [issueId]);

  async function reload() {
    const data = await fetchPanel(issueId);
    setIssue(data.issue);
    setComments(data.comments);
  }

  return (
    <aside className="icol flex h-full w-[360px] shrink-0 flex-col overflow-hidden rounded-lg border border-info/40 bg-card shadow-lg">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", mode === "branch" ? "bg-info" : STATUS_DOT[issue?.status ?? node?.status ?? "open"])} />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">
          {mode === "branch" ? "New branch" : (
            <>
              {issue?.number != null || node?.number != null ? (
                <span className="mr-1 font-normal tabular-nums text-muted-foreground">#{issue?.number ?? node?.number}</span>
              ) : null}
              {issue?.title ?? node?.title ?? "…"}
            </>
          )}
        </p>
        <Link
          href={`/issues/${issueId}`}
          title="Open full page"
          className="rounded p-1 text-muted-foreground transition hover:text-foreground"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <button type="button" onClick={onClose} title="Close panel" className="rounded p-1 text-muted-foreground transition hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {mode === "branch" ? (
        <BranchForm
          parentId={issueId}
          parentTitle={issue?.title ?? node?.title ?? ""}
          onCancel={() => onModeChange("discuss")}
          onDone={() => {
            onBranched(issueId);
            onModeChange("discuss");
            router.refresh();
          }}
        />
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : error ? (
        <p className="p-4 text-xs text-muted-foreground">{error}</p>
      ) : issue ? (
        <DiscussView
          issue={issue}
          node={node}
          comments={comments}
          onStatusChanged={async (status) => {
            const form = new FormData();
            form.set("status", status);
            await updateIssueStatus(issue.id, form);
            setIssue((prev) => (prev ? { ...prev, status } : prev));
            router.refresh();
          }}
          onCommented={async (body) => {
            const form = new FormData();
            form.set("body", body);
            await addIssueComment(issue.id, form);
            await reload();
            router.refresh();
          }}
          onBranch={() => onModeChange("branch")}
        />
      ) : null}
    </aside>
  );
}

function DiscussView({
  issue,
  node,
  comments,
  onStatusChanged,
  onCommented,
  onBranch,
}: {
  issue: PanelIssue;
  node: IssueTreeNode | null;
  comments: PanelComment[];
  onStatusChanged: (status: string) => Promise<void>;
  onCommented: (body: string) => Promise<void>;
  onBranch: () => void;
}) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [comments.length]);

  return (
    <>
      {/* Controls */}
      <div className="space-y-2 border-b border-border/70 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <select
            value={issue.status}
            disabled={savingStatus}
            onChange={async (e) => {
              setSavingStatus(true);
              try {
                await onStatusChanged(e.target.value);
              } finally {
                setSavingStatus(false);
              }
            }}
            className="h-7 rounded-md border border-border/80 bg-background px-2 text-xs outline-none focus:border-info/60"
          >
            {ISSUE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {savingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          <span className="ml-auto text-[10px] capitalize text-muted-foreground">{issue.priority}</span>
          {issue.checklistTotal > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <ListChecks className="h-3 w-3" />
              {issue.checklistDone}/{issue.checklistTotal}
            </span>
          ) : null}
        </div>
        {node && node.children.length > 0 ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="progress-fill h-full rounded-full" style={{ width: `${Math.round(node.progress * 100)}%` }} />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              branch {node.subtreeDone}/{node.subtreeCount}
            </span>
          </div>
        ) : null}
      </div>

      {/* Description */}
      {issue.description ? (
        <div className="max-h-32 overflow-y-auto border-b border-border/70 px-3 py-2.5">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{issue.description}</p>
        </div>
      ) : null}

      {/* Discussion */}
      <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {comments.length ? (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-muted/50 px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11px] font-semibold">{comment.authorName}</span>
                {comment.createdMs ? <span className="shrink-0 text-[10px] text-muted-foreground">{relative(comment.createdMs)}</span> : null}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed">{comment.body}</p>
              {comment.attachments.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {comment.attachments.map((a) => (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="text-[10px] text-info underline">
                      {a.name}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="flex items-center justify-center gap-1.5 py-8 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> No discussion yet — start it below.
          </p>
        )}
      </div>

      {/* Composer + actions */}
      <div className="space-y-2 border-t border-border/70 p-2.5">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const text = body.trim();
            if (!text || sending) return;
            setSending(true);
            try {
              await onCommented(text);
              setBody("");
            } finally {
              setSending(false);
            }
          }}
          className="flex items-end gap-1.5"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add to the discussion…"
            rows={2}
            className="min-h-[3rem] flex-1 resize-none rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition disabled:opacity-40"
            title="Send"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </form>
        <button
          type="button"
          onClick={onBranch}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-info/40 px-3 py-1.5 text-xs font-medium text-info transition hover:bg-info/10"
        >
          <GitBranchPlus className="h-3.5 w-3.5" />
          Branch a sub-issue
        </button>
      </div>
    </>
  );
}

function BranchForm({
  parentId,
  parentTitle,
  onCancel,
  onDone,
}: {
  parentId: string;
  parentTitle: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        try {
          const form = new FormData(e.currentTarget);
          await createIssue(form);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not create the sub-issue.");
          setSubmitting(false);
        }
      }}
    >
      <p className="rounded-lg bg-info/10 px-2.5 py-2 text-[11px] leading-relaxed text-info">
        Branching from <span className="font-semibold">{parentTitle}</span> — the new issue links back and feeds its progress.
      </p>
      <input type="hidden" name="parent_issue_id" value={parentId} />
      <input type="hidden" name="stay_on_page" value="1" />

      <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
        Title
        <input
          name="title"
          required
          autoFocus
          placeholder="What needs to happen?"
          className="block h-8 w-full rounded-lg border border-border/80 bg-background px-2.5 text-xs font-normal text-foreground outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
        />
      </label>

      <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
        Details
        <textarea
          name="description"
          required
          rows={4}
          placeholder="Context, idea, or plan for this branch…"
          className="block w-full resize-none rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs font-normal text-foreground outline-none transition focus:border-info/60 focus:ring-2 focus:ring-info/20"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
          Kind
          <select name="kind" defaultValue="task" className="block h-8 w-full rounded-lg border border-border/80 bg-background px-2 text-xs font-normal text-foreground outline-none">
            {ISSUE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-medium text-muted-foreground">
          Priority
          <select name="priority" defaultValue="normal" className="block h-8 w-full rounded-lg border border-border/80 bg-background px-2 text-xs font-normal text-foreground outline-none">
            {ISSUE_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      <div className="mt-auto flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex flex-[2] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranchPlus className="h-3.5 w-3.5" />}
          Create branch
        </button>
      </div>
    </form>
  );
}

async function fetchPanel(
  issueId: string,
  signal?: AbortSignal
): Promise<{ issue: PanelIssue; comments: PanelComment[] }> {
  const res = await fetch(`/api/issues/${issueId}/panel`, { signal });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
  return data;
}

const STATUS_DOT: Record<string, string> = {
  open: "bg-info",
  in_progress: "bg-warning",
  blocked: "bg-destructive",
  done: "bg-success",
  closed: "bg-muted-foreground",
};

function relative(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
