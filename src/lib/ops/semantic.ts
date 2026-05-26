import type { IssuePriority, IssueStatus, LocationKind, UserRole } from "@/src/types/firestore";

export const roleStyles: Record<
  UserRole,
  { label: string; badgeClass: string; dotClass: string }
> = {
  admin: {
    label: "Admin",
    badgeClass: "border-role-admin/35 bg-role-admin/12 text-role-admin",
    dotClass: "bg-role-admin",
  },
  manager: {
    label: "Manager",
    badgeClass: "border-role-manager/35 bg-role-manager/12 text-role-manager",
    dotClass: "bg-role-manager",
  },
  member: {
    label: "Member",
    badgeClass: "border-role-member/35 bg-role-member/12 text-role-member",
    dotClass: "bg-role-member",
  },
};

export const locationKindStyles: Record<
  LocationKind,
  { label: string; borderClass: string; badgeClass: string }
> = {
  store: {
    label: "Store",
    borderClass: "border-l-location-store",
    badgeClass: "border-location-store/35 bg-location-store/12 text-location-store",
  },
  warehouse: {
    label: "Warehouse",
    borderClass: "border-l-location-warehouse",
    badgeClass: "border-location-warehouse/35 bg-location-warehouse/12 text-location-warehouse",
  },
  hq: {
    label: "HQ",
    borderClass: "border-l-location-hq",
    badgeClass: "border-location-hq/35 bg-location-hq/12 text-location-hq",
  },
  office: {
    label: "Office",
    borderClass: "border-l-location-office",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
  global: {
    label: "Global",
    borderClass: "border-l-border",
    badgeClass: "border-border bg-muted text-muted-foreground",
  },
};

export function locationBorderClass(kind: LocationKind | undefined) {
  if (!kind) return "border-l-transparent";
  return locationKindStyles[kind].borderClass;
}

export function statusBorderClass(status: IssueStatus): string {
  switch (status) {
    case "in_progress": return "border-l-info";
    case "blocked":     return "border-l-destructive";
    case "done":        return "border-l-success";
    case "closed":      return "border-l-success/50";
    default:            return "border-l-border"; // open
  }
}

export const priorityStyles: Record<
  IssuePriority,
  { label: string; badgeVariant: "urgent" | "warning" | "default" | "muted"; rowClass: string; borderClass: string }
> = {
  urgent: {
    label: "Urgent",
    badgeVariant: "urgent",
    rowClass: "issue-row-urgent bg-destructive/[0.08] hover:bg-destructive/[0.12]",
    borderClass: "border-l-destructive",
  },
  high: {
    label: "High",
    badgeVariant: "warning",
    rowClass: "bg-warning/[0.06] hover:bg-warning/[0.1]",
    borderClass: "border-l-warning",
  },
  normal: {
    label: "Normal",
    badgeVariant: "default",
    rowClass: "",
    borderClass: "border-l-transparent",
  },
  low: {
    label: "Low",
    badgeVariant: "muted",
    rowClass: "",
    borderClass: "border-l-transparent",
  },
};

export function isUrgentPriority(priority: IssuePriority) {
  return priority === "urgent";
}

export function priorityRowClass(priority: IssuePriority) {
  return priorityStyles[priority].rowClass;
}

export function priorityBorderClass(priority: IssuePriority) {
  return priorityStyles[priority].borderClass;
}
