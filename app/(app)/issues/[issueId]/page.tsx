import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BlockedWorkflowBanner } from "@/src/components/issues/BlockedWorkflowBanner";
import { PriorityBadge } from "@/src/components/issues/IssueBadges";
import { IssueAuditExportLink } from "@/src/components/issues/IssueAuditExportLink";
import { IssueDetailsMobileSummary } from "@/src/components/issues/IssueDetailsMobileSummary";
import { IssueMetaChips } from "@/src/components/issues/IssueMetaChips";
import { IssuePageHeader } from "@/src/components/issues/IssuePageHeader";
import { IssueStatusPicker } from "@/src/components/issues/IssueStatusPicker";
import { ActivityTimeline } from "@/src/components/ops/ActivityTimeline";
import { IssueDescriptionPanel } from "@/src/components/ops/IssueDescriptionPanel";
import { UrgentBanner } from "@/src/components/ops/UrgentBanner";
import { isUrgentPriority } from "@/src/lib/ops/semantic";
import { IssueDetailsSidebar } from "@/src/components/ops/IssueDetailsSidebar";
import { IssueDiscussion } from "@/src/components/ops/IssueDiscussion";
import {
  addIssueComment,
  updateIssueAssignees,
  updateIssueDescription,
  updateIssueMetadata,
  updateIssueStatus,
} from "@/src/lib/ops/actions";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { formatDate, formatDateTime, formatIssueNumber } from "@/src/lib/ops/format";
import { buildMentionUsers } from "@/src/lib/ops/mentions";
import { serializeActivityEvent, serializeUserProfile } from "@/src/lib/ops/serialize";
import { IssueChecklist } from "@/src/components/ops/IssueChecklist";
import { SubIssuesPanel } from "@/src/components/ops/SubIssuesPanel";
import { getIssue, listChecklistItems, listIssueActivity, listIssueComments, listLabels, listLocations, listProjects, listSubIssues, listUserProfiles } from "@/src/lib/ops/data";
import { cn } from "@/src/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function IssuePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const issue = await getIssue(issueId);
  if (!issue) notFound();
  const [comments, activity, checklist, subIssues, projects, locations, labels, users, session, parentIssue] = await Promise.all([
    listIssueComments(issueId),
    listIssueActivity(issueId),
    listChecklistItems(issueId),
    listSubIssues(issueId),
    listProjects(),
    listLocations(),
    listLabels(),
    listUserProfiles(),
    getCurrentUser(),
    issue.parent_issue_id ? getIssue(issue.parent_issue_id) : Promise.resolve(null),
  ]);

  const project = projects.find((item) => item.id === issue.project_id);
  const location = locations.find((item) => item.id === issue.location_id);
  const author = users.find((user) => user.uid === issue.created_by_uid);
  const userById = new Map(users.map((user) => [user.uid, user]));
  const issueLabels = issue.label_ids
    .map((id) => labels.find((label) => label.id === id))
    .filter((label): label is NonNullable<typeof label> => Boolean(label));
  const mentionUsers = buildMentionUsers(
    users.filter((user) => user.active).map((user) => ({
      uid: user.uid,
      display_name: user.display_name,
      email: user.email,
    }))
  );
  const boundComment = addIssueComment.bind(null, issue.id);
  const boundStatus = updateIssueStatus.bind(null, issue.id);
  const timelineEvents = activity.filter((event) => event.type !== "commented");

  const now = new Date();
  const isOverdue = Boolean(
    issue.due_at && issue.due_at.toDate() < now && !["done", "closed"].includes(issue.status)
  );
  const dueAtFormatted = issue.due_at ? formatDate(issue.due_at) : null;
  const showPriorityInHeader = issue.priority === "urgent" || issue.priority === "high";
  const useTaskGrid = issue.checklist_total > 0 && subIssues.length > 0;

  const sidebar = (
    <IssueDetailsSidebar
      issueId={issue.id}
      initial={{
        title: issue.title,
        status: issue.status,
        kind: issue.kind,
        priority: issue.priority,
        projectId: project?.id ?? "",
        locationId: location?.id ?? "",
        labelIds: issue.label_ids,
        assigneeUids: issue.assignee_uids,
        watcherUids: issue.watcher_uids,
        dueAt: dateInput(issue.due_at),
        blockedReason: issue.blocked_reason ?? "",
        nextStep: issue.next_step ?? "",
      }}
      labels={labels.map((label) => ({ id: label.id, name: label.name }))}
      projects={projects.map((item) => ({ id: item.id, title: item.title }))}
      locations={locations.map((item) => ({ id: item.id, name: item.name }))}
      users={users.map(serializeUserProfile)}
      currentUserUid={session?.uid ?? null}
      saveMetadataAction={updateIssueMetadata}
      savePeopleAction={updateIssueAssignees}
    />
  );

  return (
    <div>
      <IssuePageHeader
        issue={{
          issueId: issue.id,
          title: issue.title,
          issueNumber: formatIssueNumber(issue),
          status: issue.status,
          priority: issue.priority,
          priorityProminent: isUrgentPriority(issue.priority),
        }}
      >
        <div className="issue-page-header-static-inner">
          <Link
            href="/issues"
            className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Back to issues
          </Link>

          <div className="issue-page-header-static-main">
            <h1 className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              <span>{issue.title}</span>
              <span className="font-mono text-base font-normal text-muted-foreground sm:text-lg">
                {formatIssueNumber(issue)}
              </span>
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <IssueStatusPicker currentStatus={issue.status} action={boundStatus} />
              {showPriorityInHeader ? (
                <PriorityBadge priority={issue.priority} prominent={isUrgentPriority(issue.priority)} />
              ) : null}
              <IssueMetaChips
                kind={issue.kind}
                locationKind={location?.kind}
                locationName={location?.name}
                labels={issueLabels.map((label) => ({ id: label.id, name: label.name }))}
                dueAtFormatted={dueAtFormatted}
                isOverdue={isOverdue}
                assigneeUids={issue.assignee_uids}
                usersById={userById}
                parentIssue={parentIssue ? { id: parentIssue.id, title: parentIssue.title } : null}
              />
            </div>
          </div>
        </div>
      </IssuePageHeader>

      <div className="issue-page-content">
        <div className="issue-page-layout grid gap-y-6 lg:grid-cols-[1fr_min(380px,32%)]">
        <section className="order-2 min-w-0 space-y-5 lg:order-1 lg:col-start-1">
          {isUrgentPriority(issue.priority) ? <UrgentBanner /> : null}
          {issue.status === "blocked" ? (
            <BlockedWorkflowBanner
              blockedReason={issue.blocked_reason ?? null}
              nextStep={issue.next_step ?? null}
            />
          ) : null}

          <IssueDescriptionPanel
            issueId={issue.id}
            authorName={author?.display_name ?? "HQ Ops"}
            openedAt={formatDateTime(issue.created_at)}
            description={issue.description}
            saveAction={updateIssueDescription}
            mentionUsers={mentionUsers}
            compactHeader
          />

          <div className={cn("grid gap-3", useTaskGrid && "lg:grid-cols-2")}>
            <IssueChecklist
              issueId={issue.id}
              items={checklist.map((item) => ({ id: item.id, title: item.title, done: item.done }))}
              total={issue.checklist_total}
              done={issue.checklist_done}
            />
            <SubIssuesPanel parentIssueId={issue.id} subIssues={subIssues} />
          </div>

          <IssueDiscussion
            comments={comments.map((comment) => ({
              id: comment.id,
              authorName: comment.author_name,
              createdAt: formatDateTime(comment.created_at),
              body: comment.body,
              attachments: comment.attachments ?? [],
            }))}
            mentionUsers={mentionUsers}
            commentAction={boundComment}
          />

          <section className="rounded-lg border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Activity history</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Status changes, assignments, and system events</p>
              </div>
              <IssueAuditExportLink issueId={issue.id} />
            </div>
            <div className="px-4 py-3">
              {timelineEvents.length > 0 ? (
                <ActivityTimeline events={timelineEvents.map(serializeActivityEvent)} />
              ) : (
                <p className="text-sm text-muted-foreground">No activity recorded yet. You can still export an audit log.</p>
              )}
            </div>
          </section>
        </section>

        <IssueDetailsMobileSummary className="order-1 lg:order-2 lg:col-start-2">
          {sidebar}
        </IssueDetailsMobileSummary>
        </div>
      </div>
    </div>
  );
}

function dateInput(value: { toDate: () => Date } | null | undefined) {
  if (!value) return "";
  return value.toDate().toISOString().slice(0, 10);
}
