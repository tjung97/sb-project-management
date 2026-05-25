import type { AuthUser } from "@/src/lib/firebase/auth-server";
import { userCanAccessLocation } from "@/src/lib/ops/user-stores";
import type { IssueWithId } from "@/src/types/firestore";

export function canReadIssue(user: AuthUser, issue: IssueWithId) {
  return (
    user.role === "admin" ||
    issue.created_by_uid === user.uid ||
    issue.assignee_uids.includes(user.uid) ||
    issue.watcher_uids.includes(user.uid) ||
    userCanAccessLocation(user, issue.location_id)
  );
}

export function canWriteIssue(user: AuthUser, issue: IssueWithId) {
  return (
    user.role === "admin" ||
    issue.created_by_uid === user.uid ||
    issue.assignee_uids.includes(user.uid) ||
    userCanAccessLocation(user, issue.location_id)
  );
}

export function requireAdminRole(user: AuthUser) {
  if (user.role !== "admin") {
    throw new Error("Admin access required.");
  }
}

export function requireIssueRead(user: AuthUser, issue: IssueWithId) {
  if (!canReadIssue(user, issue)) {
    throw new Error("Issue not found.");
  }
}

export function requireIssueWrite(user: AuthUser, issue: IssueWithId) {
  if (!canWriteIssue(user, issue)) {
    throw new Error("You do not have permission to update this issue.");
  }
}
