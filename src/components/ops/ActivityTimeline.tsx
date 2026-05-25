"use client";

import { useState } from "react";
import { AtSign, CircleDot, GitCommit, MessageSquare, UserMinus, UserPlus, Users } from "lucide-react";
import { StatusBadge } from "@/src/components/issues/IssueBadges";
import { UserAvatar } from "@/src/components/ops/UserAvatar";
import { formatDateTime } from "@/src/lib/ops/format";
import type { ActivityEventClient } from "@/src/lib/ops/serialize";
import type { IssueStatus, PeopleChange } from "@/src/types/firestore";

const PREVIEW = 8;

export function ActivityTimeline({ events }: { events: ActivityEventClient[] }) {
  const [expanded, setExpanded] = useState(false);
  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, PREVIEW);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
      {visible.map((event) => (
        <ActivityRow key={event.id} event={event} />
      ))}
      {events.length > PREVIEW ? (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="text-sm font-medium text-primary hover:underline">
          {expanded ? "Show less activity" : `Show all ${events.length} events`}
        </button>
      ) : null}
    </div>
  );
}

function ActivityRow({ event }: { event: ActivityEventClient }) {
  return (
    <div id={`event-${event.id}`} className="flex gap-3 scroll-mt-24">
      <div className="flex w-10 justify-center">
        <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background">
          {iconForType(event.type)}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1 py-0.5 text-sm">
        <p className="text-muted-foreground">
          <UserAvatar uid={event.actor_uid} name={event.actor_name} size="sm" className="mr-2 align-middle" />
          <span className="font-medium text-foreground">{event.actor_name}</span> {headline(event)}{" "}
          <time className="text-xs">{formatDateTime(event.created_at)}</time>
        </p>
        {event.changes?.length ? <PeopleChangeLines changes={event.changes} actorName={event.actor_name} /> : null}
        {event.type === "status_changed" && event.before?.status && event.after?.status ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.before.status as IssueStatus} />
            <span className="text-muted-foreground">→</span>
            <StatusBadge status={event.after.status as IssueStatus} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PeopleChangeLines({ changes, actorName }: { changes: PeopleChange[]; actorName: string }) {
  return (
    <ul className="space-y-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
      {changes.map((change) => (
        <li key={`${change.field}-${change.op}-${change.uid}`} className="flex items-center gap-2">
          <UserAvatar uid={change.uid} name={change.display_name} size="sm" />
          <span>
            <span className="font-medium text-foreground">{actorName}</span>{" "}
            {change.op === "added"
              ? change.field === "assignee_uids"
                ? "assigned"
                : "added watcher"
              : change.field === "assignee_uids"
                ? "unassigned"
                : "removed watcher"}{" "}
            <span className="font-medium text-foreground">{change.display_name}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function headline(event: ActivityEventClient) {
  if (event.changes?.length) {
    const assigneeAdds = event.changes.filter((c) => c.field === "assignee_uids" && c.op === "added").length;
    const assigneeRemoves = event.changes.filter((c) => c.field === "assignee_uids" && c.op === "removed").length;
    if (assigneeAdds || assigneeRemoves) {
      const parts = [];
      if (assigneeAdds) parts.push(`assigned ${assigneeAdds}`);
      if (assigneeRemoves) parts.push(`unassigned ${assigneeRemoves}`);
      return parts.join(", ");
    }
    return "updated watchers";
  }
  return event.summary.replace(event.actor_name, "").trim() || "updated this issue";
}

function iconForType(type: ActivityEventClient["type"]) {
  switch (type) {
    case "assigned":
      return <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />;
    case "unassigned":
      return <UserMinus className="h-3.5 w-3.5 text-muted-foreground" />;
    case "watchers_changed":
      return <Users className="h-3.5 w-3.5 text-muted-foreground" />;
    case "mentioned":
      return <AtSign className="h-3.5 w-3.5 text-muted-foreground" />;
    case "commented":
      return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    case "status_changed":
    case "updated":
      return <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}
