import type { Timestamp } from "firebase/firestore";

export type LocationKind = "store" | "warehouse" | "hq" | "office" | "global";
export type UserRole = "admin" | "manager" | "member";
export type IssueStatus = "open" | "in_progress" | "blocked" | "done" | "closed";
export type IssuePriority = "low" | "normal" | "high" | "urgent";
export type IssueKind =
  | "task"
  | "fix"
  | "project"
  | "follow_up"
  | "email"
  | "onboarding"
  | "warehouse"
  | "store_work"
  | "office_work";
export type ActivityType =
  | "created"
  | "updated"
  | "commented"
  | "assigned"
  | "unassigned"
  | "status_changed"
  | "priority_changed"
  | "due_date_changed"
  | "project_changed"
  | "watchers_changed"
  | "mentioned"
  | "checklist_changed"
  | "archived"
  | "restored"
  | "notification_sent";

export type PeopleChangeOp = "added" | "removed";
export type PeopleField = "assignee_uids" | "watcher_uids";

export interface PeopleChange {
  field: PeopleField;
  op: PeopleChangeOp;
  uid: string;
  display_name: string;
}

export type InboxChangeType = "assigned" | "unassigned" | "watcher_added" | "watcher_removed" | "unassigned_48h" | "blocked_72h";

export interface UserProfile {
  uid: string;
  email: string | null;
  display_name: string;
  role: UserRole;
  /** @deprecated Use store_ids. Kept for legacy documents. */
  store_id?: string | null;
  store_ids: string[];
  active: boolean;
  notification_email: boolean;
  notification_slack: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Location {
  name: string;
  code: string;
  kind: LocationKind;
  active: boolean;
  sort_order: number;
}

export interface LocationWithId extends Location {
  id: string;
}

export interface Label {
  name: string;
  color: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
  description?: string;
}

export interface LabelWithId extends Label {
  id: string;
}

export interface Project {
  title: string;
  description: string;
  status: "active" | "paused" | "completed" | "archived";
  owner_uid: string | null;
  location_ids: string[];
  issue_count: number;
  open_issue_count: number;
  done_issue_count: number;
  blocked_issue_count: number;
  due_at: Timestamp | null;
  blocked_reason?: string | null;
  next_step?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by_uid: string;
}

export interface ProjectWithId extends Project {
  id: string;
}

export interface Issue {
  issue_number?: number;
  title: string;
  description: string;
  kind: IssueKind;
  status: IssueStatus;
  priority: IssuePriority;
  location_id: string | null;
  project_id: string | null;
  parent_issue_id: string | null;
  assignee_uids: string[];
  watcher_uids: string[];
  label_ids: string[];
  due_at: Timestamp | null;
  blocked_reason?: string | null;
  next_step?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  closed_at: Timestamp | null;
  archived_at?: Timestamp | null;
  created_by_uid: string;
  updated_by_uid: string;
  last_activity_summary: string;
  last_comment_author_name?: string | null;
  last_comment_at?: Timestamp | null;
  last_comment_preview?: string | null;
  comment_count: number;
  activity_count: number;
  checklist_total: number;
  checklist_done: number;
}

export interface ChecklistItem {
  title: string;
  done: boolean;
  sort_order: number;
  created_at: Timestamp;
  created_by_uid: string;
}

export interface ChecklistItemWithId extends ChecklistItem {
  id: string;
}

export interface IssueWithId extends Issue {
  id: string;
}

export interface IssueComment {
  body: string;
  attachments?: CommentAttachment[];
  author_uid: string;
  author_name: string;
  created_at: Timestamp;
  updated_at: Timestamp | null;
}

export interface CommentAttachment {
  name: string;
  url: string;
  kind: "link" | "file" | "image";
}

export interface IssueCommentWithId extends IssueComment {
  id: string;
}

export interface ActivityEvent {
  type: ActivityType;
  actor_uid: string;
  actor_name: string;
  summary: string;
  changes?: PeopleChange[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  notification_event_id?: string;
  created_at: Timestamp;
}

export interface ActivityEventWithId extends ActivityEvent {
  id: string;
}

export interface NotificationEvent {
  issue_id: string;
  project_id: string | null;
  type: "assignment" | "comment" | "mention" | "status" | "due_date" | "completion";
  actor_uid: string;
  recipient_uids: string[];
  channel: "email" | "slack" | "both";
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed" | "skipped";
  created_at: Timestamp;
  processed_at: Timestamp | null;
  error?: string;
}

export interface NotificationInboxItem {
  uid: string;
  issue_id: string;
  issue_number: number | null;
  project_id: string | null;
  type: NotificationEvent["type"];
  change_type: InboxChangeType | null;
  activity_id: string | null;
  subject: string;
  body: string;
  read: boolean;
  read_at?: Timestamp | null;
  created_at: Timestamp;
}

export interface NotificationPreference {
  uid: string;
  default_view: string;
  density: "comfortable" | "compact";
  digest_mode: boolean;
  notification_email: boolean;
  notification_slack: boolean;
  updated_at: Timestamp;
}

export interface RecurringTemplate {
  name: string;
  template_id: string;
  active: boolean;
  cadence: "weekly" | "monthly";
  next_run_at: Timestamp;
  default_location_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by_uid: string;
}

export interface RecurringTemplateWithId extends RecurringTemplate {
  id: string;
}

export type EmploymentStatus = "active" | "on_leave" | "terminated";
export type PayType = "salary" | "hourly";
export type PayFrequency = "annual" | "monthly" | "biweekly" | "weekly";
export type HrFeedbackType = "review" | "check_in" | "recognition" | "concern" | "other";

export interface EmployeeCompSnapshot {
  pay_type: PayType;
  amount: number;
  currency: string;
  pay_frequency: PayFrequency;
  effective_date: Timestamp | null;
  job_title: string | null;
}

export interface Employee {
  employee_number: string | null;
  legal_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  uid: string | null;
  location_id: string | null;
  department: string | null;
  job_title: string | null;
  employment_status: EmploymentStatus;
  hire_date: Timestamp | null;
  termination_date: Timestamp | null;
  manager_employee_id: string | null;
  notes: string;
  current_comp: EmployeeCompSnapshot | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  created_by_uid: string;
}

export interface EmployeeWithId extends Employee {
  id: string;
}

export interface EmployeeCompEntry {
  pay_type: PayType;
  amount: number;
  currency: string;
  pay_frequency: PayFrequency;
  effective_date: Timestamp;
  job_title: string | null;
  notes: string;
  created_at: Timestamp;
  created_by_uid: string;
  created_by_name: string;
}

export interface EmployeeCompEntryWithId extends EmployeeCompEntry {
  id: string;
}

export interface EmployeeFeedback {
  type: HrFeedbackType;
  title: string;
  body: string;
  rating: number | null;
  author_uid: string;
  author_name: string;
  created_at: Timestamp;
}

export interface EmployeeFeedbackWithId extends EmployeeFeedback {
  id: string;
}

export interface EmployeeFolder {
  name: string;
  parent_folder_id: string | null;
  sort_order: number;
  created_at: Timestamp;
}

export interface EmployeeFolderWithId extends EmployeeFolder {
  id: string;
}

export interface EmployeeDocument {
  folder_id: string | null;
  name: string;
  file_name: string;
  storage_path: string;
  download_url: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by_uid: string;
  uploaded_by_name: string;
  uploaded_at: Timestamp;
}

export interface EmployeeDocumentWithId extends EmployeeDocument {
  id: string;
}
