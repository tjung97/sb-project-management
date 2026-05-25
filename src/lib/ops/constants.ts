import type { IssueKind, IssuePriority, IssueStatus } from "@/src/types/firestore";

export const ISSUE_STATUSES: Array<{ value: IssueStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "closed", label: "Closed" },
];

export const ISSUE_PRIORITIES: Array<{ value: IssuePriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const ISSUE_KINDS: Array<{ value: IssueKind; label: string; description: string }> = [
  { value: "task", label: "Task", description: "General operational work." },
  { value: "fix", label: "Fix", description: "Maintenance, repair, or broken process." },
  { value: "project", label: "Project", description: "Work tied to a larger project." },
  { value: "follow_up", label: "Follow-up", description: "Something that must not get lost." },
  { value: "email", label: "Email", description: "Email thread or vendor/customer response." },
  { value: "onboarding", label: "Onboarding", description: "New sign, store, vendor, or team setup." },
  { value: "warehouse", label: "Warehouse", description: "Warehouse request or fulfillment work." },
  { value: "store_work", label: "Store work", description: "Store-level operations task." },
  { value: "office_work", label: "Office work", description: "Back office or admin work." },
];

export const DEFAULT_LABELS = [
  { id: "maintenance", name: "Maintenance", color: "red", description: "Repairs, equipment, facilities." },
  { id: "follow-up", name: "Follow-up", color: "yellow", description: "Needs a clear next touch." },
  { id: "vendor", name: "Vendor", color: "blue", description: "Outside vendor or supplier." },
  { id: "store", name: "Store", color: "green", description: "Store operations." },
  { id: "urgent", name: "Urgent", color: "red", description: "Time-sensitive work." },
] as const;
