import type { PeopleChange, PeopleField } from "@/src/types/firestore";

export function buildUserDisplayMap(users: Array<{ uid: string; display_name: string }>) {
  return new Map(users.map((user) => [user.uid, user.display_name]));
}

export function diffPeople(field: PeopleField, before: string[], after: string[], userMap: Map<string, string>): PeopleChange[] {
  const added = after.filter((uid) => !before.includes(uid));
  const removed = before.filter((uid) => !after.includes(uid));
  return [
    ...added.map((uid) => ({
      field,
      op: "added" as const,
      uid,
      display_name: userMap.get(uid) ?? "Team member",
    })),
    ...removed.map((uid) => ({
      field,
      op: "removed" as const,
      uid,
      display_name: userMap.get(uid) ?? "Team member",
    })),
  ];
}

export function activityTypeForPeopleChanges(changes: PeopleChange[]): "assigned" | "unassigned" | "watchers_changed" | null {
  const assigneeChanges = changes.filter((change) => change.field === "assignee_uids");
  const watcherChanges = changes.filter((change) => change.field === "watcher_uids");
  if (assigneeChanges.length > 0) {
    return assigneeChanges.some((change) => change.op === "added") ? "assigned" : "unassigned";
  }
  if (watcherChanges.length > 0) return "watchers_changed";
  return null;
}

export function summarizePeopleChanges(actorName: string, changes: PeopleChange[]) {
  const parts = changes.map((change) => {
    const verb = change.op === "added" ? (change.field === "assignee_uids" ? "assigned" : "added watcher") : change.field === "assignee_uids" ? "unassigned" : "removed watcher";
    return `${actorName} ${verb} ${change.display_name}`;
  });
  return parts.join("; ");
}

export function assigneeAdds(changes: PeopleChange[]) {
  return changes.filter((change) => change.field === "assignee_uids" && change.op === "added").map((change) => change.uid);
}

export function assigneeRemoves(changes: PeopleChange[]) {
  return changes.filter((change) => change.field === "assignee_uids" && change.op === "removed").map((change) => change.uid);
}

export function watcherAdds(changes: PeopleChange[]) {
  return changes.filter((change) => change.field === "watcher_uids" && change.op === "added").map((change) => change.uid);
}
