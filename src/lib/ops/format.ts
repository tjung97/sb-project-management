import type { Timestamp } from "firebase/firestore";
import type { IssuePriority, IssueStatus, IssueWithId } from "@/src/types/firestore";

export function formatIssueNumber(issue: Pick<IssueWithId, "issue_number" | "id">) {
  if (issue.issue_number && issue.issue_number > 0) return `#${issue.issue_number}`;
  return `#${issue.id.slice(0, 6)}`;
}

function toDate(value: Timestamp | Date | string | number | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") return new Date(value);
  if (typeof (value as Timestamp).toDate === "function") return (value as Timestamp).toDate();
  return null;
}

export function formatDate(value: Timestamp | Date | string | number | null | undefined) {
  const date = toDate(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatDateTime(value: Timestamp | Date | string | number | null | undefined) {
  const date = toDate(value);
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(
  value: Timestamp | Date | string | number | null | undefined,
  now: Date = new Date()
) {
  const date = toDate(value);
  if (!date) return "unknown";
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(date);
}

/** Plain-text preview for comment excerpts (strips common markdown). */
export function markdownPreview(text: string, maxLength = 160) {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trimEnd()}…`;
}

export function statusLabel(status: IssueStatus) {
  return status.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function priorityLabel(priority: IssuePriority) {
  return priority.replace(/^\w/, (letter) => letter.toUpperCase());
}
