import type { IssueKind, IssuePriority } from "@/src/types/firestore";

export interface IssueTemplateDefinition {
  id: string;
  name: string;
  description: string;
  kind: IssueKind;
  priority: IssuePriority;
  location_id: string | null;
  label_ids: string[];
  default_assignee_role: "admin" | "manager" | "member" | null;
  title: string;
  body: string;
  due_days: number | null;
  checklist: string[];
  suggested_recurrence: "weekly" | "monthly" | null;
}

export const ISSUE_TEMPLATES: IssueTemplateDefinition[] = [
  {
    id: "new-store-opening",
    name: "New store opening",
    description: "Launch checklist for equipment, training, signage, and vendor coordination.",
    kind: "onboarding",
    priority: "high",
    location_id: "global",
    label_ids: ["follow-up", "store"],
    default_assignee_role: "admin",
    title: "New store opening readiness",
    body: "## Opening checklist\n- Confirm equipment delivery windows\n- Schedule staff training dates\n- Verify signage vendor install date\n- Walk opening-day roles with store manager",
    due_days: 30,
    checklist: ["Equipment delivered and installed", "Staff training scheduled", "Signage install date confirmed", "Opening-day runbook shared with store"],
    suggested_recurrence: null,
  },
  {
    id: "vendor-outage",
    name: "Vendor outage",
    description: "Track vendor delays, substitute suppliers, and store impact.",
    kind: "follow_up",
    priority: "urgent",
    location_id: "warehouse",
    label_ids: ["vendor", "urgent"],
    default_assignee_role: "manager",
    title: "Vendor outage follow-up",
    body: "Vendor impact:\n- What is delayed?\n- Which stores are affected?\n- Backup vendor or substitute plan?\n- ETA for resolution",
    due_days: 2,
    checklist: ["Contact vendor for ETA", "Notify affected stores", "Confirm substitute supply", "Close loop when resolved"],
    suggested_recurrence: null,
  },
  {
    id: "health-inspection",
    name: "Health inspection follow-up",
    description: "Remediation tasks after an inspection or pre-inspection prep.",
    kind: "store_work",
    priority: "high",
    location_id: null,
    label_ids: ["follow-up", "store"],
    default_assignee_role: "manager",
    title: "Health inspection follow-up",
    body: "Inspection notes:\n- Citation or observation\n- Owner for fix\n- Photo evidence needed?\n- Re-inspection date if applicable",
    due_days: 7,
    checklist: ["Document findings", "Assign store owner", "Complete remediation", "Verify with photos"],
    suggested_recurrence: null,
  },
  {
    id: "weekly-inventory",
    name: "Weekly inventory review",
    description: "Recurring warehouse inventory and shortage review.",
    kind: "warehouse",
    priority: "normal",
    location_id: "warehouse",
    label_ids: ["follow-up"],
    default_assignee_role: "member",
    title: "Weekly inventory review",
    body: "Review par levels, shortages, and store requests from the past week.",
    due_days: 7,
    checklist: ["Review shortage report", "Update par levels", "Reply to open store requests"],
    suggested_recurrence: "weekly",
  },
];

export function getIssueTemplate(id: string) {
  return ISSUE_TEMPLATES.find((template) => template.id === id) ?? null;
}
