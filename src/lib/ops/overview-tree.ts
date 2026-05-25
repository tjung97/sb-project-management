import type { AuthUser } from "@/src/lib/firebase/auth-server";
import { canReadIssue } from "@/src/lib/ops/authz";
import { formatRelativeTime, markdownPreview } from "@/src/lib/ops/format";
import type { IssueStatus, IssueWithId, LocationKind, LocationWithId, ProjectWithId } from "@/src/types/firestore";

export type IssueBucket = "open" | "urgent" | "blocked" | "overdue" | "done";

export interface IssueStats {
  open: number;
  urgent: number;
  blocked: number;
  overdue: number;
  done: number;
  total: number;
}

export interface OverviewLatestFollowUp {
  authorName: string;
  relativeAt: string;
  preview: string;
}

export interface OverviewIssueNode {
  id: string;
  title: string;
  issue_number: number | undefined;
  status: IssueStatus;
  bucket: IssueBucket;
  href: string;
  latestFollowUp: OverviewLatestFollowUp | null;
}

export interface OverviewProjectNode {
  id: string;
  title: string;
  stats: IssueStats;
  issues: OverviewIssueNode[];
}

export interface OverviewLocationNode {
  id: string;
  name: string;
  kind: LocationKind;
  stats: IssueStats;
  projects: OverviewProjectNode[];
  unlinkedIssues: OverviewIssueNode[];
}

export interface OpsOverviewTree {
  scopeLabel: string;
  locations: OverviewLocationNode[];
  totals: IssueStats;
}

const EMPTY_STATS: IssueStats = { open: 0, urgent: 0, blocked: 0, overdue: 0, done: 0, total: 0 };

const OPERATIONAL_KINDS: LocationKind[] = ["store", "warehouse", "hq"];

export function emptyIssueStats(): IssueStats {
  return { ...EMPTY_STATS };
}

export function classifyIssueBucket(issue: IssueWithId, now: Date): IssueBucket {
  if (issue.status === "done" || issue.status === "closed") return "done";
  if (issue.status === "blocked") return "blocked";
  if (issue.priority === "urgent") return "urgent";
  if (issue.due_at && issue.due_at.toDate() < now) return "overdue";
  return "open";
}

export function accumulateStats(stats: IssueStats, bucket: IssueBucket) {
  stats[bucket] += 1;
  stats.total += 1;
}

export function statsFromIssues(issues: IssueWithId[], now: Date): IssueStats {
  const stats = emptyIssueStats();
  for (const issue of issues) {
    accumulateStats(stats, classifyIssueBucket(issue, now));
  }
  return stats;
}

export function visibleOverviewLocations(
  user: AuthUser,
  locations: LocationWithId[],
  issues: IssueWithId[],
  projects: ProjectWithId[]
): LocationWithId[] {
  const active = locations.filter((location) => location.active);
  const issueLocationIds = new Set(issues.map((issue) => issue.location_id).filter(Boolean) as string[]);
  const projectLocationIds = new Set(projects.flatMap((project) => project.location_ids));

  if (user.role === "admin") {
    return active.filter(
      (location) =>
        OPERATIONAL_KINDS.includes(location.kind) ||
        issueLocationIds.has(location.id) ||
        projectLocationIds.has(location.id)
    );
  }

  if (user.storeIds.length > 0) {
    const allowed = new Set(user.storeIds);
    return active.filter((location) => allowed.has(location.id));
  }

  return active.filter(
    (location) =>
      issueLocationIds.has(location.id) &&
      issues.some((issue) => issue.location_id === location.id && canReadIssue(user, issue))
  );
}

export function overviewScopeLabel(user: AuthUser, locations: OverviewLocationNode[]) {
  if (user.role === "admin") {
    return `All locations (${locations.length})`;
  }
  if (locations.length === 1) {
    return locations[0].name;
  }
  return "Your locations";
}

function projectsForLocation(locationId: string, projects: ProjectWithId[], issues: IssueWithId[]) {
  const ids = new Set<string>();
  for (const project of projects) {
    if (project.location_ids.includes(locationId)) ids.add(project.id);
  }
  for (const issue of issues) {
    if (issue.location_id === locationId && issue.project_id) ids.add(issue.project_id);
  }
  return [...ids]
    .map((id) => projects.find((project) => project.id === id))
    .filter((project): project is ProjectWithId => Boolean(project))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function allOverviewLocationIds(tree: OpsOverviewTree): Set<string> {
  return new Set(tree.locations.map((location) => location.id));
}

export function allOverviewProjectKeys(tree: OpsOverviewTree): Set<string> {
  const keys = new Set<string>();
  for (const location of tree.locations) {
    for (const project of location.projects) {
      keys.add(`${location.id}:${project.id}`);
    }
  }
  return keys;
}

export function buildOpsOverviewTree(
  user: AuthUser,
  locations: LocationWithId[],
  projects: ProjectWithId[],
  issues: IssueWithId[],
  now = new Date()
): OpsOverviewTree {
  const readableIssues = issues.filter((issue) => canReadIssue(user, issue));
  const visibleLocations = visibleOverviewLocations(user, locations, readableIssues, projects);
  const totals = statsFromIssues(readableIssues, now);

  const locationNodes: OverviewLocationNode[] = visibleLocations.map((location) => {
    const atLocation = readableIssues.filter((issue) => issue.location_id === location.id);
    const locationProjects = projectsForLocation(location.id, projects, readableIssues);

    const projectNodes: OverviewProjectNode[] = locationProjects.map((project) => {
      const projectIssues = atLocation.filter((issue) => issue.project_id === project.id);
      return {
        id: project.id,
        title: project.title,
        stats: statsFromIssues(projectIssues, now),
        issues: projectIssues
          .sort((a, b) => a.title.localeCompare(b.title))
          .map((issue) => toIssueNode(issue, now)),
      };
    });

    const unlinkedIssues = atLocation
      .filter((issue) => !issue.project_id || !locationProjects.some((project) => project.id === issue.project_id))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((issue) => toIssueNode(issue, now));

    return {
      id: location.id,
      name: location.name,
      kind: location.kind,
      stats: statsFromIssues(atLocation, now),
      projects: projectNodes.filter((project) => project.stats.total > 0 || project.issues.length > 0),
      unlinkedIssues,
    };
  });

  return {
    scopeLabel: overviewScopeLabel(user, locationNodes),
    locations: locationNodes.filter(
      (location) => location.stats.total > 0 || location.projects.length > 0 || location.unlinkedIssues.length > 0
    ),
    totals,
  };
}

export function resolveLatestFollowUp(issue: IssueWithId, now: Date): OverviewLatestFollowUp | null {
  if (issue.comment_count <= 0) return null;

  const authorName =
    issue.last_comment_author_name?.trim() ||
    issue.last_activity_summary.match(/^(.+?)\s+commented\b/i)?.[1]?.trim() ||
    null;
  if (!authorName) return null;

  const at = issue.last_comment_at ?? issue.updated_at;
  const preview =
    issue.last_comment_preview?.trim() ||
    (issue.last_activity_summary.toLowerCase().endsWith(" commented") ? "" : issue.last_activity_summary);

  return {
    authorName,
    relativeAt: formatRelativeTime(at, now),
    preview: preview ? markdownPreview(preview, 120) : "",
  };
}

function toIssueNode(issue: IssueWithId, now: Date): OverviewIssueNode {
  return {
    id: issue.id,
    title: issue.title,
    issue_number: issue.issue_number,
    status: issue.status,
    bucket: classifyIssueBucket(issue, now),
    href: `/issues/${issue.id}`,
    latestFollowUp: resolveLatestFollowUp(issue, now),
  };
}
