import type { IssueStatus, IssueWithId } from "@/src/types/firestore";

// Serialized, client-safe issue tree. Built once on the server from the flat
// issue list (parent_issue_id links) and handed to the interactive canvas.

export interface IssueTreeNode {
  id: string;
  number: number | null;
  title: string;
  status: IssueStatus;
  priority: string;
  commentCount: number;
  checklistTotal: number;
  checklistDone: number;
  dueMs: number | null;
  overdue: boolean;
  children: IssueTreeNode[];
  /** Issues in this subtree, including self. */
  subtreeCount: number;
  /** Fully resolved (done/closed) issues in the subtree, including self. */
  subtreeDone: number;
  /**
   * Smooth completion score 0..1: each issue contributes 1 when done/closed,
   * otherwise its checklist fraction. Parents average their whole subtree, so
   * a branch fills up as its leaves get resolved.
   */
  progress: number;
}

export interface IssueTreeStats {
  total: number;
  done: number;
  open: number;
  blocked: number;
  inProgress: number;
  progress: number;
}

const DONE_STATUSES: IssueStatus[] = ["done", "closed"];

function issueScore(issue: IssueWithId): number {
  if (DONE_STATUSES.includes(issue.status)) return 1;
  if (issue.checklist_total > 0) return issue.checklist_done / issue.checklist_total;
  return 0;
}

export function buildIssueTree(issues: IssueWithId[]): { roots: IssueTreeNode[]; stats: IssueTreeStats } {
  const active = issues.filter((issue) => !issue.archived_at);
  const byParent = new Map<string | null, IssueWithId[]>();
  const ids = new Set(active.map((issue) => issue.id));

  for (const issue of active) {
    // Treat orphans (parent filtered out or deleted) as roots so nothing vanishes.
    const parent = issue.parent_issue_id && ids.has(issue.parent_issue_id) ? issue.parent_issue_id : null;
    const list = byParent.get(parent) ?? [];
    list.push(issue);
    byParent.set(parent, list);
  }

  const now = Date.now();

  const toNode = (issue: IssueWithId): IssueTreeNode => {
    const children = (byParent.get(issue.id) ?? []).map(toNode);
    const ownScore = issueScore(issue);
    const subtreeCount = 1 + children.reduce((sum, child) => sum + child.subtreeCount, 0);
    const subtreeDone =
      (DONE_STATUSES.includes(issue.status) ? 1 : 0) + children.reduce((sum, child) => sum + child.subtreeDone, 0);
    const scoreSum = ownScore + children.reduce((sum, child) => sum + child.progress * child.subtreeCount, 0);
    const dueMs = issue.due_at ? issue.due_at.toMillis() : null;

    return {
      id: issue.id,
      number: issue.issue_number ?? null,
      title: issue.title || "Untitled",
      status: issue.status,
      priority: issue.priority,
      commentCount: issue.comment_count,
      checklistTotal: issue.checklist_total,
      checklistDone: issue.checklist_done,
      dueMs,
      overdue: dueMs != null && dueMs < now && !DONE_STATUSES.includes(issue.status),
      children,
      subtreeCount,
      subtreeDone,
      progress: scoreSum / subtreeCount,
    };
  };

  const sortNodes = (nodes: IssueTreeNode[]): IssueTreeNode[] => {
    nodes.sort((a, b) => {
      // Unfinished branches first, then bigger branches, then newest number.
      const aDone = a.progress >= 1 ? 1 : 0;
      const bDone = b.progress >= 1 ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (a.subtreeCount !== b.subtreeCount) return b.subtreeCount - a.subtreeCount;
      return (b.number ?? 0) - (a.number ?? 0);
    });
    for (const node of nodes) sortNodes(node.children);
    return nodes;
  };

  const roots = sortNodes((byParent.get(null) ?? []).map(toNode));

  const stats: IssueTreeStats = {
    total: active.length,
    done: active.filter((issue) => DONE_STATUSES.includes(issue.status)).length,
    open: active.filter((issue) => issue.status === "open").length,
    blocked: active.filter((issue) => issue.status === "blocked").length,
    inProgress: active.filter((issue) => issue.status === "in_progress").length,
    progress: active.length ? active.reduce((sum, issue) => sum + issueScore(issue), 0) / active.length : 0,
  };

  return { roots, stats };
}
