import type { ActivityEventWithId, IssueWithId, LocationWithId, ProjectWithId, UserProfile } from "@/src/types/firestore";
import { formatDate, formatDateTime, formatIssueNumber } from "@/src/lib/ops/format";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

export function issuesToCsvRows(params: {
  issues: IssueWithId[];
  users: UserProfile[];
  locations: LocationWithId[];
  projects: ProjectWithId[];
}) {
  const userById = new Map(params.users.map((user) => [user.uid, user.display_name]));
  const locationById = new Map(params.locations.map((location) => [location.id, location.name]));
  const projectById = new Map(params.projects.map((project) => [project.id, project.title]));
  return params.issues.map((issue) => ({
    number: formatIssueNumber(issue),
    title: issue.title,
    status: issue.status,
    priority: issue.priority,
    kind: issue.kind,
    location: issue.location_id ? locationById.get(issue.location_id) ?? issue.location_id : "",
    project: issue.project_id ? projectById.get(issue.project_id) ?? issue.project_id : "",
    assignees: issue.assignee_uids.map((uid) => userById.get(uid) ?? uid).join("; "),
    due: formatDate(issue.due_at),
    created: formatDateTime(issue.created_at),
    updated: formatDateTime(issue.updated_at),
    checklist: `${issue.checklist_done}/${issue.checklist_total}`,
  }));
}

export function activityToCsvRows(events: ActivityEventWithId[]) {
  return events.map((event) => ({
    type: event.type,
    actor: event.actor_name,
    summary: event.summary,
    created: formatDateTime(event.created_at),
    before: JSON.stringify(event.before ?? {}),
    after: JSON.stringify(event.after ?? {}),
    changes: JSON.stringify(event.changes ?? []),
  }));
}
