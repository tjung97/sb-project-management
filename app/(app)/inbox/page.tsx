import Link from "next/link";
import { Bell, Clock3, Eye, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardListBody, CardListHeader, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { SelectField } from "@/src/components/ui/select-field";
import { PriorityBadge, StatusBadge } from "@/src/components/issues/IssueBadges";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { markAllNotificationsRead, markNotificationRead } from "@/src/lib/ops/actions";
import { updateNotificationPreferences } from "@/src/lib/ops/actions";
import { formatDate, formatIssueNumber } from "@/src/lib/ops/format";
import { listAssignmentChangeNotifications, listIssues, listMyNotifications } from "@/src/lib/ops/data";
import type { InboxChangeType, NotificationInboxItem } from "@/src/types/firestore";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  const [issues, notifications, assignmentChanges] = await Promise.all([
    listIssues({ status: "openish" }, 200),
    listMyNotifications(),
    listAssignmentChangeNotifications(),
  ]);
  const assigned = user ? issues.filter((issue) => issue.assignee_uids.includes(user.uid)) : [];
  const watching = user ? issues.filter((issue) => issue.watcher_uids.includes(user.uid) && !issue.assignee_uids.includes(user.uid)) : [];
  const blocked = issues.filter((issue) => issue.status === "blocked");
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueSoon = issues.filter((issue) => issue.due_at && issue.due_at.toDate() <= weekEnd && !["done", "closed"].includes(issue.status));
  const recent = issues.slice(0, 8);
  const blockedAndRecent = uniqueIssuesById([...blocked, ...recent]).slice(0, 10);
  const unread = notifications.filter((notification) => !notification.read);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Assignments, mentions, and changes that need your response."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardListHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <CardTitle>Unread notifications</CardTitle>
            </div>
            <CardDescription>In-app records for comments, mentions, status changes, and assignments.</CardDescription>
            {unread.length > 0 ? (
              <form action={markAllNotificationsRead}>
                <button className="mt-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50">Mark all read</button>
              </form>
            ) : null}
          </CardListHeader>
          <CardListBody>
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              notifications.map((notification) => (
                <NotificationRow key={notification.id} notification={notification} />
              ))
            )}
          </CardListBody>
        </Card>
        <Card className="overflow-hidden">
          <CardListHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <CardTitle>Assignment changes</CardTitle>
            </div>
            <CardDescription>When you were assigned, unassigned, or added as a watcher—with links to the audit event.</CardDescription>
          </CardListHeader>
          <CardListBody>
            {assignmentChanges.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No assignment changes yet.</p>
            ) : (
              assignmentChanges.map((notification) => (
                <NotificationRow key={`assignment-${notification.id}`} notification={notification} />
              ))
            )}
          </CardListBody>
        </Card>
        <InboxSection icon={UserCheck} title="Assigned to me" description="Your direct ownership queue" issues={assigned} />
        <InboxSection icon={Eye} title="Watching" description="Work you are following but do not own" issues={watching} />
        <InboxSection icon={Clock3} title="Due soon" description="Open work due within seven days" issues={dueSoon} />
        <InboxSection icon={Bell} title="Blocked / recently updated" description="Blocked first, then newest updates" issues={blockedAndRecent} />
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Control digest and default display behavior.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateNotificationPreferences} className="space-y-3 text-sm">
              <SelectField
                name="default_view"
                defaultValue="inbox"
                placeholder="Default view"
                options={[
                  { value: "inbox", label: "Inbox" },
                  { value: "assigned", label: "Assigned to me" },
                  { value: "blocked", label: "Blocked" },
                ]}
              />
              <SelectField
                name="density"
                defaultValue="comfortable"
                placeholder="Density"
                options={[
                  { value: "comfortable", label: "Comfortable density" },
                  { value: "compact", label: "Compact density" },
                ]}
              />
              <label className="flex items-center gap-2"><input name="digest_mode" type="checkbox" defaultChecked /> Daily digest</label>
              <label className="flex items-center gap-2"><input name="notification_email" type="checkbox" defaultChecked /> Email notifications</label>
              <label className="flex items-center gap-2"><input name="notification_slack" type="checkbox" /> Slack notifications</label>
              <Button type="submit">Save preferences</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NotificationRow({ notification }: { notification: NotificationInboxItem & { id: string } }) {
  const href = notification.activity_id
    ? `/issues/${notification.issue_id}#event-${notification.activity_id}`
    : `/issues/${notification.issue_id}`;
  const issueRef = notification.issue_number ? `#${notification.issue_number}` : null;

  return (
    <div className={notification.read ? "p-4 opacity-70" : "p-4"}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <Link href={href} className="flex flex-wrap items-center gap-2 hover:underline">
          {notification.change_type ? <ChangeBadge changeType={notification.change_type} /> : null}
          {issueRef ? <Badge variant="outline">{issueRef}</Badge> : null}
          {!notification.read ? <Badge variant="info">Unread</Badge> : null}
        </Link>
        {!notification.read ? (
          <form action={markNotificationRead.bind(null, notification.id)}>
            <button className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50">Mark read</button>
          </form>
        ) : null}
      </div>
      <Link href={href} className="block hover:underline">
        <p className="font-medium">{notification.subject}</p>
      </Link>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
    </div>
  );
}

function ChangeBadge({ changeType }: { changeType: InboxChangeType }) {
  const labels: Record<InboxChangeType, { label: string; icon: typeof UserPlus }> = {
    assigned: { label: "Assigned", icon: UserPlus },
    unassigned: { label: "Unassigned", icon: UserMinus },
    watcher_added: { label: "Watching", icon: Eye },
    watcher_removed: { label: "Unwatched", icon: Eye },
    unassigned_48h: { label: "Unassigned 48h+", icon: Bell },
    blocked_72h: { label: "Blocked 72h+", icon: Bell },
  };
  const item = labels[changeType];
  const Icon = item.icon;
  return (
    <Badge variant={changeType === "assigned" ? "default" : changeType === "unassigned" ? "destructive" : "outline"} className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {item.label}
    </Badge>
  );
}

function uniqueIssuesById(issues: Awaited<ReturnType<typeof listIssues>>) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  });
}

function InboxSection({
  icon: Icon,
  title,
  description,
  issues,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  issues: Awaited<ReturnType<typeof listIssues>>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardListHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardListHeader>
      <CardListBody>
        {issues.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground sm:px-6">Nothing here.</p>
        ) : (
          issues.map((issue) => (
            <Link key={issue.id} href={`/issues/${issue.id}`} className="block px-5 py-4 hover:bg-accent/40 sm:py-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusBadge status={issue.status} />
                <PriorityBadge priority={issue.priority} />
              </div>
              <p className="font-medium">
                {issue.title} <span className="font-normal text-muted-foreground">{formatIssueNumber(issue)}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(issue.due_at)} · {issue.last_activity_summary}</p>
            </Link>
          ))
        )}
      </CardListBody>
    </Card>
  );
}
