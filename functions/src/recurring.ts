export type RecurringIssueTemplateDefinition = {
  title: string;
  description: string;
  kind: string;
  priority: string;
  label_ids: string[];
  checklist: string[];
  due_days: number;
};

export const RECURRING_ISSUE_TEMPLATES: Record<string, RecurringIssueTemplateDefinition> = {
  "weekly-inventory": {
    title: "Weekly inventory review",
    description: "Review par levels, shortages, and store requests from the past week.",
    kind: "warehouse",
    priority: "normal",
    label_ids: ["follow-up"],
    checklist: ["Review shortage report", "Update par levels", "Reply to open store requests"],
    due_days: 7,
  },
  "vendor-outage": {
    title: "Vendor outage follow-up",
    description: "Track vendor delays, substitutes, store impact, and resolution ETA.",
    kind: "follow_up",
    priority: "urgent",
    label_ids: ["vendor", "urgent"],
    checklist: ["Contact vendor for ETA", "Notify affected stores", "Confirm substitute supply", "Close loop when resolved"],
    due_days: 2,
  },
};

export const recurringIssueTemplateIds = Object.keys(RECURRING_ISSUE_TEMPLATES);

export function dueDateFromDays(from: Date, dueDays: number) {
  const due = new Date(from);
  due.setDate(due.getDate() + dueDays);
  due.setHours(17, 0, 0, 0);
  return due;
}
