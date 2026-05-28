import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/src/lib/firebase/admin";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { profileStoreIds, storeIdsFromTokenClaims } from "@/src/lib/ops/user-stores";
import { canReadIssue, requireIssueRead } from "@/src/lib/ops/authz";
import type {
  ActivityEventWithId,
  CalendarEventWithId,
  ChecklistItemWithId,
  IssueCommentWithId,
  IssueWithId,
  LabelWithId,
  LocationWithId,
  ProjectWithId,
  UserProfile,
  IssuePriority,
  IssueStatus,
  NotificationInboxItem,
  NotificationPreference,
  RecurringTemplateWithId,
} from "@/src/types/firestore";

export interface IssueFilters {
  status?: IssueStatus | "all" | "openish" | "closed";
  assignee?: string;
  unassigned?: boolean;
  watcher?: string;
  location?: string;
  project?: string;
  priority?: IssuePriority;
  kind?: string;
  label?: string;
  due?: "overdue" | "today" | "week" | "none";
  stale?: "blocked_72h" | "unassigned_48h";
  q?: string;
}

export interface HqHealthMetrics {
  blocked: number;
  overdue: number;
  unassigned: number;
  unassignedStale: number;
  open: number;
}

export interface PilotFeedbackItem {
  id: string;
  scenario?: string;
  rating?: number;
  worked_well?: string;
  friction?: string;
  still_used_outside_tool?: string;
}

export function normalizeIssue(id: string, data: Record<string, unknown>): IssueWithId {
  return {
    id,
    issue_number: (data.issue_number as number | undefined) ?? undefined,
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    kind: (data.kind as IssueWithId["kind"]) ?? "task",
    status: (data.status as IssueStatus) ?? "open",
    priority: (data.priority as IssuePriority) ?? "normal",
    location_id: (data.location_id as string | null) ?? null,
    project_id: (data.project_id as string | null) ?? null,
    parent_issue_id: (data.parent_issue_id as string | null) ?? null,
    assignee_uids: (data.assignee_uids as string[]) ?? [],
    watcher_uids: (data.watcher_uids as string[]) ?? [],
    label_ids: (data.label_ids as string[]) ?? [],
    due_at: (data.due_at as IssueWithId["due_at"]) ?? null,
    blocked_reason: (data.blocked_reason as string | null) ?? null,
    next_step: (data.next_step as string | null) ?? null,
    created_at: data.created_at as IssueWithId["created_at"],
    updated_at: data.updated_at as IssueWithId["updated_at"],
    closed_at: (data.closed_at as IssueWithId["closed_at"]) ?? null,
    archived_at: (data.archived_at as IssueWithId["archived_at"]) ?? null,
    created_by_uid: String(data.created_by_uid ?? ""),
    updated_by_uid: String(data.updated_by_uid ?? ""),
    last_activity_summary: String(data.last_activity_summary ?? ""),
    last_comment_author_name: (data.last_comment_author_name as string | null | undefined) ?? null,
    last_comment_at: (data.last_comment_at as IssueWithId["last_comment_at"]) ?? null,
    last_comment_preview: (data.last_comment_preview as string | null | undefined) ?? null,
    comment_count: Number(data.comment_count ?? 0),
    activity_count: Number(data.activity_count ?? 0),
    checklist_total: Number(data.checklist_total ?? 0),
    checklist_done: Number(data.checklist_done ?? 0),
  };
}

export async function listIssues(filters: IssueFilters = {}, limit = 200): Promise<IssueWithId[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const snapshot = await adminDb.collection("issues").orderBy("updated_at", "desc").limit(limit).get();
  const issues = snapshot.docs
    .map((doc) => normalizeIssue(doc.id, doc.data() as Record<string, unknown>))
    .filter((issue) => canReadIssue(user, issue));
  const base = applyIssueFilters(issues, filters);
  if (!filters.q?.trim()) return base;

  const [users, locations, projects, labels] = await Promise.all([
    adminDb.collection("userProfiles").limit(100).get(),
    adminDb.collection("locations").get(),
    adminDb.collection("projects").limit(100).get(),
    adminDb.collection("labels").get(),
  ]);
  const userById = new Map(users.docs.map((doc) => [doc.id, String(doc.get("display_name") ?? doc.get("email") ?? "")]));
  const locationById = new Map(locations.docs.map((doc) => [doc.id, String(doc.get("name") ?? "")]));
  const projectById = new Map(projects.docs.map((doc) => [doc.id, String(doc.get("title") ?? "")]));
  const labelById = new Map(labels.docs.map((doc) => [doc.id, String(doc.get("name") ?? "")]));
  const q = filters.q.trim().toLowerCase().replace(/^#/, "");

  return base.filter((issue) => {
    const haystack = [
      issue.title,
      issue.description,
      issue.last_activity_summary,
      issue.issue_number ?? "",
      issue.location_id ? locationById.get(issue.location_id) : "",
      issue.project_id ? projectById.get(issue.project_id) : "",
      ...issue.assignee_uids.map((uid) => userById.get(uid) ?? ""),
      ...issue.label_ids.map((id) => labelById.get(id) ?? ""),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function getIssueByNumber(issueNumber: number): Promise<IssueWithId | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const snapshot = await adminDb.collection("issues").where("issue_number", "==", issueNumber).limit(1).get();
  if (snapshot.empty) return null;
  const issue = normalizeIssue(snapshot.docs[0].id, snapshot.docs[0].data() as Record<string, unknown>);
  return canReadIssue(user, issue) ? issue : null;
}

export async function listAllIssuesForExport(filters: IssueFilters = {}): Promise<IssueWithId[]> {
  return listIssues(filters, 1000);
}

export function computeHqHealth(issues: IssueWithId[]): HqHealthMetrics {
  const now = Date.now();
  const staleMs = 48 * 60 * 60 * 1000;
  const open = issues.filter((issue) => !["done", "closed"].includes(issue.status));
  const unassigned = open.filter((issue) => issue.assignee_uids.length === 0);
  return {
    open: open.length,
    blocked: open.filter((issue) => issue.status === "blocked").length,
    overdue: open.filter((issue) => issue.due_at && issue.due_at.toDate().getTime() < now).length,
    unassigned: unassigned.length,
    unassignedStale: unassigned.filter((issue) => issue.updated_at && now - issue.updated_at.toMillis() > staleMs).length,
  };
}

export async function listChecklistItems(issueId: string): Promise<ChecklistItemWithId[]> {
  const issue = await getIssue(issueId);
  if (!issue) return [];
  const snapshot = await adminDb
    .collection("issues")
    .doc(issueId)
    .collection("checklist")
    .orderBy("sort_order", "asc")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ChecklistItemWithId);
}

export async function listSubIssues(parentIssueId: string): Promise<IssueWithId[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const snapshot = await adminDb.collection("issues").where("parent_issue_id", "==", parentIssueId).limit(40).get();
  return snapshot.docs
    .map((doc) => normalizeIssue(doc.id, doc.data() as Record<string, unknown>))
    .filter((issue) => canReadIssue(user, issue))
    .sort((a, b) => b.updated_at.toMillis() - a.updated_at.toMillis());
}

export async function listProjects(): Promise<ProjectWithId[]> {
  const snapshot = await adminDb.collection("projects").orderBy("updated_at", "desc").limit(80).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ProjectWithId);
}

export async function listLocations(): Promise<LocationWithId[]> {
  const snapshot = await adminDb.collection("locations").orderBy("sort_order", "asc").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LocationWithId);
}

export async function listLabels(): Promise<LabelWithId[]> {
  const snapshot = await adminDb.collection("labels").orderBy("name", "asc").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as LabelWithId);
}

function normalizeUserProfile(data: UserProfile): UserProfile {
  const store_ids = profileStoreIds(data);
  return {
    ...data,
    store_ids,
    store_id: store_ids[0] ?? null,
  };
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  const profiles = await adminDb.collection("userProfiles").where("active", "==", true).limit(100).get();
  if (!profiles.empty) {
    return profiles.docs.map((doc) => normalizeUserProfile(doc.data() as UserProfile));
  }

  const users = await adminAuth.listUsers(100);
  const now = Timestamp.now() as unknown as UserProfile["created_at"];
  return users.users.map((user) => {
    const store_ids = storeIdsFromTokenClaims((user.customClaims ?? {}) as Record<string, unknown>);
    return normalizeUserProfile({
      uid: user.uid,
      email: user.email ?? null,
      display_name: user.displayName ?? user.email ?? "Team member",
      role: ((user.customClaims?.role as UserProfile["role"] | undefined) ?? "member"),
      store_ids,
      store_id: store_ids[0] ?? null,
      active: !user.disabled,
      notification_email: true,
      notification_slack: false,
      created_at: now,
      updated_at: now,
    });
  });
}

export async function getIssue(issueId: string): Promise<IssueWithId | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const doc = await adminDb.collection("issues").doc(issueId).get();
  if (!doc.exists) return null;
  const issue = normalizeIssue(doc.id, doc.data() as Record<string, unknown>);
  requireIssueRead(user, issue);
  return issue;
}

export async function getProject(projectId: string): Promise<ProjectWithId | null> {
  const doc = await adminDb.collection("projects").doc(projectId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ProjectWithId;
}

export async function listIssueComments(issueId: string): Promise<IssueCommentWithId[]> {
  const issue = await getIssue(issueId);
  if (!issue) return [];
  const snapshot = await adminDb
    .collection("issues")
    .doc(issueId)
    .collection("comments")
    .orderBy("created_at", "asc")
    .limit(100)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as IssueCommentWithId);
}

export async function listIssueActivity(issueId: string): Promise<ActivityEventWithId[]> {
  const issue = await getIssue(issueId);
  if (!issue) return [];
  const snapshot = await adminDb
    .collection("issues")
    .doc(issueId)
    .collection("activity")
    .orderBy("created_at", "desc")
    .limit(80)
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ActivityEventWithId);
}

export async function listProjectIssues(projectId: string): Promise<IssueWithId[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const snapshot = await adminDb
    .collection("issues")
    .where("project_id", "==", projectId)
    .orderBy("updated_at", "desc")
    .limit(120)
    .get();
  return snapshot.docs
    .map((doc) => normalizeIssue(doc.id, doc.data() as Record<string, unknown>))
    .filter((issue) => canReadIssue(user, issue));
}

export async function listMyNotifications(limit = 20): Promise<Array<NotificationInboxItem & { id: string }>> {
  const user = await getCurrentUser();
  if (!user) return [];
  const snapshot = await adminDb
    .collection("notificationInbox")
    .where("uid", "==", user.uid)
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as NotificationInboxItem & { id: string })
    .sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis())
    .slice(0, limit);
}

export async function listGroupedNotifications(limit = 60) {
  const notifications = await listMyNotifications(limit);
  const groups = new Map<string, Array<NotificationInboxItem & { id: string }>>();
  for (const notification of notifications) {
    const key = notification.issue_id;
    groups.set(key, [...(groups.get(key) ?? []), notification]);
  }
  return Array.from(groups.entries()).map(([issueId, items]) => ({
    issueId,
    latest: items[0],
    unreadCount: items.filter((item) => !item.read).length,
    items,
  }));
}

export async function listNotificationPreferences(uid: string): Promise<NotificationPreference> {
  const doc = await adminDb.collection("notificationPreferences").doc(uid).get();
  if (doc.exists) return doc.data() as NotificationPreference;
  const profile = await adminDb.collection("userProfiles").doc(uid).get();
  return {
    uid,
    default_view: "inbox",
    density: "comfortable",
    digest_mode: true,
    notification_email: profile.exists ? profile.get("notification_email") !== false : true,
    notification_slack: profile.exists ? profile.get("notification_slack") === true : false,
    updated_at: Timestamp.now() as unknown as NotificationPreference["updated_at"],
  };
}

export async function listRecurringTemplates(): Promise<RecurringTemplateWithId[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [];
  const snapshot = await adminDb.collection("recurringTemplates").orderBy("next_run_at", "asc").limit(80).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as RecurringTemplateWithId);
}

export async function listUserSetupGaps() {
  const profiles = await listUserProfiles();
  return profiles.filter((profile) => {
    const normalized = normalizeUserProfile(profile);
    return !normalized.email || !normalized.role || profileStoreIds(normalized).length === 0;
  });
}

export async function getSystemHealth() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  const [failedNotifications, pendingNotifications, recurringTemplates, setupGaps] = await Promise.all([
    adminDb.collection("notificationEvents").where("status", "==", "failed").limit(10).get(),
    adminDb.collection("notificationEvents").where("status", "==", "pending").limit(10).get(),
    listRecurringTemplates(),
    listUserSetupGaps(),
  ]);

  return {
    failedNotifications: failedNotifications.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    pendingNotifications: pendingNotifications.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    recurringTemplates,
    setupGaps,
    env: {
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      resend: Boolean(process.env.RESEND_API_KEY),
      slack: Boolean(process.env.SLACK_WEBHOOK_URL),
      storage: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    },
  };
}

export async function listPilotFeedback(limit = 30) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [];
  const snapshot = await adminDb.collection("pilotFeedback").orderBy("created_at", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PilotFeedbackItem);
}

export async function listAssignmentChangeNotifications(limit = 12): Promise<Array<NotificationInboxItem & { id: string }>> {
  const user = await getCurrentUser();
  if (!user) return [];
  const changeTypes = new Set(["assigned", "unassigned", "watcher_added", "watcher_removed"]);
  const snapshot = await adminDb.collection("notificationInbox").where("uid", "==", user.uid).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as NotificationInboxItem & { id: string })
    .filter((item) => item.change_type && changeTypes.has(item.change_type))
    .sort((a, b) => b.created_at.toMillis() - a.created_at.toMillis())
    .slice(0, limit);
}

function applyIssueFilters(issues: IssueWithId[], filters: IssueFilters) {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

  return issues.filter((issue) => {
    if (filters.status && filters.status !== "all") {
      if (filters.status === "openish" && ["done", "closed"].includes(issue.status)) return false;
      else if (filters.status === "closed" && !["done", "closed"].includes(issue.status)) return false;
      else if (!["openish", "closed"].includes(filters.status) && issue.status !== filters.status) return false;
    }
    if (issue.archived_at && filters.status !== "all" && filters.status !== "closed") return false;
    if (filters.unassigned && issue.assignee_uids.length > 0) return false;
    if (filters.assignee && !issue.assignee_uids.includes(filters.assignee)) return false;
    if (filters.kind && issue.kind !== filters.kind) return false;
    if (filters.watcher && !issue.watcher_uids.includes(filters.watcher)) return false;
    if (filters.location && issue.location_id !== filters.location) return false;
    if (filters.project && issue.project_id !== filters.project) return false;
    if (filters.priority && issue.priority !== filters.priority) return false;
    if (filters.label && !issue.label_ids.includes(filters.label)) return false;
    if (filters.due) {
      const due = issue.due_at?.toDate();
      if (filters.due === "none" && due) return false;
      if (filters.due === "overdue" && (!due || due >= now || ["done", "closed"].includes(issue.status))) return false;
      if (filters.due === "today" && (!due || due >= todayEnd || due < new Date(now.getFullYear(), now.getMonth(), now.getDate()))) return false;
      if (filters.due === "week" && (!due || due > weekEnd || ["done", "closed"].includes(issue.status))) return false;
    }
    if (filters.stale) {
      const ageMs = now.getTime() - issue.updated_at.toMillis();
      if (filters.stale === "blocked_72h" && (issue.status !== "blocked" || ageMs < 72 * 60 * 60 * 1000)) return false;
      if (filters.stale === "unassigned_48h" && (issue.assignee_uids.length > 0 || ageMs < 48 * 60 * 60 * 1000 || ["done", "closed"].includes(issue.status))) return false;
    }
    return true;
  });
}

export interface IssueDueSummary {
  id: string;
  title: string;
  due_at: Timestamp;
  status: IssueStatus;
  priority: IssuePriority;
}

export async function listIssuesWithDue(): Promise<IssueDueSummary[]> {
  // Avoid composite index: skip orderBy and sort in JS; filter status in JS
  const snapshot = await adminDb
    .collection("issues")
    .where("due_at", "!=", null)
    .limit(500)
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: String(data.title ?? ""),
        due_at: data.due_at as Timestamp,
        status: (data.status as IssueStatus) ?? "open",
        priority: (data.priority as IssuePriority) ?? "normal",
      };
    })
    .filter((issue) => !["done", "closed"].includes(issue.status))
    .sort((a, b) => a.due_at.toMillis() - b.due_at.toMillis());
}

export async function listCalendarEvents(uid: string): Promise<CalendarEventWithId[]> {
  // Skip orderBy to avoid requiring a composite index; sort in JS instead
  const snapshot = await adminDb
    .collection("calendar_events")
    .where("created_by_uid", "==", uid)
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: String(data.title ?? ""),
        date: data.date as CalendarEventWithId["date"],
        notes: String(data.notes ?? ""),
        color: (data.color as CalendarEventWithId["color"]) ?? null,
        created_by_uid: String(data.created_by_uid ?? ""),
        created_at: data.created_at as CalendarEventWithId["created_at"],
      };
    })
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());
}
