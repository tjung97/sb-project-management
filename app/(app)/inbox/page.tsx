import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AtSign, Bell, CheckCircle2, Clock3, Eye, EyeOff, Inbox, MessageSquare, UserCheck, UserMinus, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardListBody, CardListHeader, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { SelectField } from "@/src/components/ui/select-field";
import { PriorityBadge, StatusBadge } from "@/src/components/issues/IssueBadges";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { assignIssueToMe, markAllNotificationsRead, markIssueNotificationsRead, setIssueWatching } from "@/src/lib/ops/actions";
import { updateNotificationPreferences } from "@/src/lib/ops/actions";
import { formatDate, formatIssueNumber, formatRelativeTime } from "@/src/lib/ops/format";
import { listGroupedNotifications, listIssues, listNotificationPreferences } from "@/src/lib/ops/data";
import { cn } from "@/src/lib/utils";
import type { InboxChangeType, IssueWithId, NotificationInboxItem } from "@/src/types/firestore";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  const [issues, notificationGroups, preferences] = await Promise.all([
    listIssues({ status: "openish" }, 200),
    listGroupedNotifications(),
    user ? listNotificationPreferences(user.uid) : Promise.resolve(null),
  ]);
  const assigned = user ? issues.filter((issue) => issue.assignee_uids.includes(user.uid)) : [];
  const watching = user ? issues.filter((issue) => issue.watcher_uids.includes(user.uid) && !issue.assignee_uids.includes(user.uid)) : [];
  const blocked = issues.filter((issue) => issue.status === "blocked");
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueSoon = issues.filter((issue) => issue.due_at && issue.due_at.toDate() <= weekEnd && !["done", "closed"].includes(issue.status));
  const needsResponse = notificationGroups
    .filter((group) => group.unreadCount > 0)
    .sort((a, b) => notificationPriority(a.latest) - notificationPriority(b.latest) || b.latest.created_at.toMillis() - a.latest.created_at.toMillis());
  const followingNotifications = notificationGroups.filter((group) => group.unreadCount === 0).slice(0, 8);
  const ownership = uniqueIssuesById([...blocked.filter((issue) => user && issue.assignee_uids.includes(user.uid)), ...dueSoon.filter((issue) => user && issue.assignee_uids.includes(user.uid)), ...assigned]).slice(0, 12);
  const unreadCount = needsResponse.reduce((sum, group) => sum + group.unreadCount, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inbox"
        description="Assignments, mentions, and changes that need your response."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="overflow-hidden">
          <CardListHeader>
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              <CardTitle>Needs response</CardTitle>
            </div>
            <CardDescription>{unreadCount} unread update{unreadCount === 1 ? "" : "s"} grouped by issue.</CardDescription>
            {unreadCount > 0 ? (
              <form action={markAllNotificationsRead} className="mt-1">
                <button className={buttonVariants({ variant: "outline", size: "sm" })}>Mark all read</button>
              </form>
            ) : null}
          </CardListHeader>
          <CardListBody>
            {needsResponse.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nothing needs a response right now.</p>
            ) : (
              needsResponse.map((group) => (
                <NotificationThread key={group.issueId} group={group} issue={issueById.get(group.issueId) ?? null} userUid={user?.uid ?? null} />
              ))
            )}
          </CardListBody>
        </Card>

        <Card className="overflow-hidden">
          <CardListHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              <CardTitle>My ownership</CardTitle>
            </div>
            <CardDescription>Assigned work, blocked items, and due dates that are yours to move.</CardDescription>
          </CardListHeader>
          <CardListBody>
            {ownership.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No owned work needs attention.</p>
            ) : (
              ownership.map((issue) => <InboxIssueRow key={issue.id} issue={issue} />)
            )}
          </CardListBody>
        </Card>

        <InboxSection icon={Eye} title="Watching" description="Work you follow but do not own" issues={watching.slice(0, 10)} />

        <Card className="overflow-hidden">
          <CardListHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <CardTitle>Following updates</CardTitle>
            </div>
            <CardDescription>Read or lower-priority updates grouped by issue.</CardDescription>
          </CardListHeader>
          <CardListBody>
            {followingNotifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No background updates yet.</p>
            ) : (
              followingNotifications.map((group) => (
                <NotificationThread key={`read-${group.issueId}`} group={group} issue={issueById.get(group.issueId) ?? null} userUid={user?.uid ?? null} quiet />
              ))
            )}
          </CardListBody>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/80">
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Control digest and default display behavior.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateNotificationPreferences} className="space-y-3 text-sm">
              <SelectField
                name="default_view"
                defaultValue={preferences?.default_view ?? "inbox"}
                placeholder="Default view"
                options={[
                  { value: "inbox", label: "Inbox" },
                  { value: "assigned", label: "Assigned to me" },
                  { value: "blocked", label: "Blocked" },
                ]}
              />
              <SelectField
                name="density"
                defaultValue={preferences?.density ?? "comfortable"}
                placeholder="Density"
                options={[
                  { value: "comfortable", label: "Comfortable density" },
                  { value: "compact", label: "Compact density" },
                ]}
              />
              <label className="flex items-center gap-2"><input name="digest_mode" type="checkbox" defaultChecked={preferences?.digest_mode ?? true} /> Daily digest</label>
              <label className="flex items-center gap-2"><input name="notification_email" type="checkbox" defaultChecked={preferences?.notification_email ?? true} /> Email notifications</label>
              <label className="flex items-center gap-2"><input name="notification_slack" type="checkbox" defaultChecked={preferences?.notification_slack ?? false} /> Slack notifications</label>
              <Button type="submit">Save preferences</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type NotificationGroup = Awaited<ReturnType<typeof listGroupedNotifications>>[number];

function NotificationThread({
  group,
  issue,
  userUid,
  quiet = false,
}: {
  group: NotificationGroup;
  issue: IssueWithId | null;
  userUid: string | null;
  quiet?: boolean;
}) {
  const latest = group.latest;
  const action = markIssueNotificationsRead.bind(null, group.issueId);
  const assignAction = assignIssueToMe.bind(null, group.issueId);
  const watchAction = setIssueWatching.bind(null, group.issueId, true);
  const unwatchAction = setIssueWatching.bind(null, group.issueId, false);
  const href = latest.activity_id
    ? `/issues/${latest.issue_id}#event-${latest.activity_id}`
    : `/issues/${latest.issue_id}`;
  const issueRef = latest.issue_number ? `#${latest.issue_number}` : null;
  const intent = notificationIntent(latest);
  const IntentIcon = intent.icon;
  const isAssigned = Boolean(userUid && issue?.assignee_uids.includes(userUid));
  const isWatching = Boolean(userUid && issue?.watcher_uids.includes(userUid));
  const canShowIssueActions = Boolean(issue && userUid);
  const WatchIcon = isWatching ? EyeOff : Eye;
  const watchLabel = isWatching ? "Unfollow" : "Follow";

  return (
    <div className={cn("p-4", quiet && "opacity-75")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={intent.variant} className="gap-1 font-normal">
            <IntentIcon className="h-3 w-3" />
            {intent.label}
          </Badge>
          {latest.change_type ? <ChangeBadge changeType={latest.change_type} /> : null}
          {issueRef ? <Badge variant="outline">{issueRef}</Badge> : null}
          {group.unreadCount > 0 ? <Badge variant="info">{group.unreadCount} new</Badge> : null}
          <span className="text-[11px] text-muted-foreground">{formatRelativeTime(latest.created_at)}</span>
        </div>
        {group.unreadCount > 0 ? (
          <form action={action}>
            <button className={buttonVariants({ variant: "ghost", size: "sm" })}>Mark read</button>
          </form>
        ) : null}
      </div>
      <Link href={href} className="block hover:underline">
        <p className="font-medium">{latest.subject}</p>
      </Link>
      <p className="mt-2 line-clamp-3 rounded-md border border-border/80 bg-secondary/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {latest.body}
      </p>
      {group.items.length > 1 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {group.items.length} update{group.items.length === 1 ? "" : "s"} in this thread
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open issue
        </Link>
        {canShowIssueActions && !isAssigned ? (
          <form action={assignAction}>
            <button className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <UserPlus className="h-3.5 w-3.5" />
              Assign to me
            </button>
          </form>
        ) : null}
        {canShowIssueActions ? (
          <form action={isWatching ? unwatchAction : watchAction}>
            <button className={buttonVariants({ variant: "ghost", size: "sm" })}>
              <WatchIcon className="h-3.5 w-3.5" />
              {watchLabel}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function ChangeBadge({ changeType }: { changeType: InboxChangeType }) {
  const labels: Record<InboxChangeType, { label: string; icon: LucideIcon }> = {
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

function notificationIntent(item: NotificationInboxItem) {
  const intents: Record<NotificationInboxItem["type"], { label: string; icon: LucideIcon; variant: "default" | "outline" | "info" | "success" | "warning" }> = {
    mention: { label: "Mentioned you", icon: AtSign, variant: "info" },
    assignment: { label: "Ownership change", icon: UserCheck, variant: "default" },
    comment: { label: "New comment", icon: MessageSquare, variant: "outline" },
    status: { label: "Status changed", icon: Bell, variant: "outline" },
    due_date: { label: "Due date", icon: Clock3, variant: "warning" },
    completion: { label: "Completed", icon: CheckCircle2, variant: "success" },
  };
  return intents[item.type];
}

function notificationPriority(item: NotificationInboxItem) {
  const priorities: Record<NotificationInboxItem["type"], number> = {
    mention: 0,
    assignment: 1,
    comment: 2,
    due_date: 3,
    status: 4,
    completion: 5,
  };
  if (item.change_type === "blocked_72h" || item.change_type === "unassigned_48h") return 0;
  return priorities[item.type];
}

function InboxIssueRow({ issue }: { issue: Awaited<ReturnType<typeof listIssues>>[number] }) {
  return (
    <Link href={`/issues/${issue.id}`} className="block px-4 py-3.5 hover:bg-accent/40">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={issue.status} />
        <PriorityBadge priority={issue.priority} />
        {issue.status === "blocked" ? (
          <Badge variant="destructive" className="gap-1">
            <Bell className="h-3 w-3" />
            Needs movement
          </Badge>
        ) : issue.due_at ? (
          <Badge variant="outline" className="gap-1">
            <Clock3 className="h-3 w-3" />
            Due {formatDate(issue.due_at)}
          </Badge>
        ) : null}
      </div>
      <p className="font-medium">
        {issue.title} <span className="font-normal text-muted-foreground">{formatIssueNumber(issue)}</span>
      </p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {issue.next_step ? `Next: ${issue.next_step}` : issue.last_activity_summary}
      </p>
    </Link>
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
  icon: LucideIcon;
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
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          issues.map((issue) => (
            <Link key={issue.id} href={`/issues/${issue.id}`} className="block px-4 py-3.5 hover:bg-accent/40">
              <div className="mb-2 flex flex-wrap gap-1.5">
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
