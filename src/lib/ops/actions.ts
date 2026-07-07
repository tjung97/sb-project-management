"use server";

import { randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { adminDb, adminStorage } from "@/src/lib/firebase/admin";
import { requireAdminRole, requireIssueRead, requireIssueWrite } from "@/src/lib/ops/authz";
import { formatIssueNumber, markdownPreview } from "@/src/lib/ops/format";
import { getIssueTemplate } from "@/src/lib/ops/templates";
import { getProjectTemplate } from "@/src/lib/ops/project-templates";
import { attachmentKindFromName, buildLinkAttachment } from "@/src/lib/ops/attachments";
import { activityTypeForPeopleChanges, buildUserDisplayMap, diffPeople, summarizePeopleChanges } from "@/src/lib/ops/people-diff";
import { buildMentionUsers, resolveMentionUids } from "@/src/lib/ops/mentions";
import { syncUserAuthClaims } from "@/src/lib/ops/sync-user-claims";
import type { ActivityType, InboxChangeType, IssuePriority, IssueStatus, IssueWithId, PeopleChange, UserProfile } from "@/src/types/firestore";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function dueDate(formData: FormData) {
  const raw = optionalString(formData, "due_at");
  return raw ? Timestamp.fromDate(new Date(`${raw}T12:00:00`)) : null;
}

async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");
  return {
    uid: user.uid,
    name: user.name ?? user.email ?? "Team member",
    role: user.role,
    storeIds: user.storeIds,
  };
}

async function currentUserOrThrow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");
  return user;
}

async function listProfilesForDiff(): Promise<UserProfile[]> {
  const profiles = await adminDb.collection("userProfiles").where("active", "==", true).limit(100).get();
  return profiles.docs.map((doc) => doc.data() as UserProfile);
}

async function defaultAssigneesForLocation(locationId: string | null) {
  if (!locationId) return [];
  const snapshot = await adminDb
    .collection("userProfiles")
    .where("active", "==", true)
    .where("store_ids", "array-contains", locationId)
    .where("role", "==", "manager")
    .limit(2)
    .get();
  return snapshot.docs.map((doc) => doc.get("uid") as string).filter(Boolean);
}

async function projectOwner(projectId: string | null) {
  if (!projectId) return null;
  const project = await adminDb.collection("projects").doc(projectId).get();
  return (project.get("owner_uid") as string | null | undefined) ?? null;
}

async function allocateIssueNumber() {
  const counterRef = adminDb.collection("counters").doc("issues");
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? Number(snap.data()?.value ?? 0) : 0) + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

async function writeActivity(
  issueId: string,
  type: ActivityType,
  summary: string,
  actorInfo: Awaited<ReturnType<typeof actor>>,
  extra: Record<string, unknown> = {}
) {
  const ref = await adminDb.collection("issues").doc(issueId).collection("activity").add({
    type,
    actor_uid: actorInfo.uid,
    actor_name: actorInfo.name,
    summary,
    created_at: FieldValue.serverTimestamp(),
    ...extra,
  });
  return ref.id;
}

async function writePeopleActivity(
  issueId: string,
  changes: PeopleChange[],
  actorInfo: Awaited<ReturnType<typeof actor>>
) {
  if (changes.length === 0) return null;
  const type = activityTypeForPeopleChanges(changes);
  if (!type) return null;
  const summary = summarizePeopleChanges(actorInfo.name, changes);
  return writeActivity(issueId, type, summary, actorInfo, { changes });
}

async function queueNotification(params: {
  issueId: string;
  issueNumber: number | null;
  projectId: string | null;
  type: "assignment" | "comment" | "mention" | "status" | "due_date" | "completion";
  actorUid: string;
  recipientUids: string[];
  subject: string;
  body: string;
  changeType?: InboxChangeType | null;
  activityId?: string | null;
  email?: boolean;
  slack?: boolean;
}) {
  const recipientUids = Array.from(new Set(params.recipientUids.filter((uid) => uid && uid !== params.actorUid)));
  if (recipientUids.length === 0) return;

  if (params.email !== false) {
    await adminDb.collection("notificationEvents").add({
      issue_id: params.issueId,
      project_id: params.projectId,
      type: params.type,
      actor_uid: params.actorUid,
      recipient_uids: recipientUids,
      channel: params.slack ? "both" : "email",
      subject: params.subject,
      body: params.body,
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
      processed_at: null,
    });
  }

  const batch = adminDb.batch();
  for (const uid of recipientUids) {
    batch.set(adminDb.collection("notificationInbox").doc(), {
      uid,
      issue_id: params.issueId,
      issue_number: params.issueNumber,
      project_id: params.projectId,
      type: params.type,
      change_type: params.changeType ?? null,
      activity_id: params.activityId ?? null,
      subject: params.subject,
      body: params.body,
      read: false,
      read_at: null,
      created_at: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

async function uploadCommentFile(issueId: string, file: File | null) {
  if (!file || file.size === 0) return null;
  const bucket = adminStorage.bucket();
  if (!bucket.name) throw new Error("Firebase Storage bucket is not configured.");
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeName = `${randomUUID()}.${extension}`;
  const path = `ops-attachments/${issueId}/${safeName}`;
  const token = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());

  await bucket.file(path).save(buffer, {
    contentType: file.type || "application/octet-stream",
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalName: file.name,
      },
    },
  });

  return {
    name: file.name,
    url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
    kind: attachmentKindFromName(file.name, file.type),
  };
}

async function notifyPeopleChanges(params: {
  issue: IssueWithId;
  actorInfo: Awaited<ReturnType<typeof actor>>;
  changes: PeopleChange[];
  activityId: string | null;
}) {
  const ref = formatIssueNumber(params.issue);
  const title = params.issue.title;

  for (const change of params.changes) {
    if (change.field === "assignee_uids" && change.op === "added") {
      await queueNotification({
        issueId: params.issue.id,
        issueNumber: params.issue.issue_number ?? null,
        projectId: params.issue.project_id,
        type: "assignment",
        actorUid: params.actorInfo.uid,
        recipientUids: [change.uid],
        subject: `Assigned: ${title} ${ref}`,
        body: `${params.actorInfo.name} assigned you to "${title}".`,
        changeType: "assigned",
        activityId: params.activityId,
      });
    }
    if (change.field === "assignee_uids" && change.op === "removed") {
      await queueNotification({
        issueId: params.issue.id,
        issueNumber: params.issue.issue_number ?? null,
        projectId: params.issue.project_id,
        type: "assignment",
        actorUid: params.actorInfo.uid,
        recipientUids: [change.uid],
        subject: `Unassigned: ${title} ${ref}`,
        body: `${params.actorInfo.name} removed you from "${title}".`,
        changeType: "unassigned",
        activityId: params.activityId,
        email: false,
      });
    }
    if (change.field === "watcher_uids" && change.op === "added") {
      await queueNotification({
        issueId: params.issue.id,
        issueNumber: params.issue.issue_number ?? null,
        projectId: params.issue.project_id,
        type: "assignment",
        actorUid: params.actorInfo.uid,
        recipientUids: [change.uid],
        subject: `Watching: ${title} ${ref}`,
        body: `${params.actorInfo.name} added you as a watcher on "${title}".`,
        changeType: "watcher_added",
        activityId: params.activityId,
        email: false,
      });
    }
    if (change.field === "watcher_uids" && change.op === "removed") {
      await queueNotification({
        issueId: params.issue.id,
        issueNumber: params.issue.issue_number ?? null,
        projectId: params.issue.project_id,
        type: "assignment",
        actorUid: params.actorInfo.uid,
        recipientUids: [change.uid],
        subject: `No longer watching: ${title} ${ref}`,
        body: `${params.actorInfo.name} removed you as a watcher on "${title}".`,
        changeType: "watcher_removed",
        activityId: params.activityId,
        email: false,
      });
    }
  }
}

async function seedChecklist(issueId: string, titles: string[], actorUid: string) {
  if (titles.length === 0) return;
  const batch = adminDb.batch();
  const issueRef = adminDb.collection("issues").doc(issueId);
  titles.forEach((title, index) => {
    batch.set(issueRef.collection("checklist").doc(), {
      title,
      done: false,
      sort_order: index,
      created_at: FieldValue.serverTimestamp(),
      created_by_uid: actorUid,
    });
  });
  batch.update(issueRef, { checklist_total: titles.length, checklist_done: 0 });
  await batch.commit();
}

export async function createIssue(formData: FormData) {
  const actorInfo = await actor();
  const templateId = optionalString(formData, "template_id");
  const template = templateId ? getIssueTemplate(templateId) : null;
  const title = requiredString(formData, "title");
  const description = requiredString(formData, "description");
  const initialAttachmentUrl = optionalString(formData, "attachment_url");
  const initialAttachmentName = optionalString(formData, "attachment_name");
  const initialAttachmentFile = formData.get("attachment_file") instanceof File ? (formData.get("attachment_file") as File) : null;
  const projectId = optionalString(formData, "project_id");
  const parentIssueId = optionalString(formData, "parent_issue_id");
  const locationId = optionalString(formData, "location_id");
  let assigneeUids = values(formData, "assignee_uids");
  if (assigneeUids.length === 0 && template?.default_assignee_role) {
    const profiles = await listProfilesForDiff();
    assigneeUids = profiles.filter((p) => p.role === template.default_assignee_role).map((p) => p.uid).slice(0, 2);
  }
  if (assigneeUids.length === 0) {
    assigneeUids = await defaultAssigneesForLocation(locationId);
  }
  const ownerUid = await projectOwner(projectId);
  const watcherUids = Array.from(new Set([...values(formData, "watcher_uids"), actorInfo.uid, ownerUid].filter(Boolean) as string[]));
  const now = FieldValue.serverTimestamp();
  const issueNumber = await allocateIssueNumber();
  const profiles = await listProfilesForDiff();
  const userMap = buildUserDisplayMap(profiles);

  const due =
    dueDate(formData) ??
    (template?.due_days != null
      ? Timestamp.fromDate(new Date(Date.now() + template.due_days * 24 * 60 * 60 * 1000))
      : null);

  const issueRef = await adminDb.collection("issues").add({
    issue_number: issueNumber,
    title,
    description,
    kind: requiredString(formData, "kind"),
    status: "open",
    priority: requiredString(formData, "priority") as IssuePriority,
    location_id: locationId,
    project_id: projectId,
    parent_issue_id: parentIssueId,
    assignee_uids: assigneeUids,
    watcher_uids: watcherUids,
    label_ids: values(formData, "label_ids"),
    due_at: due,
    created_at: now,
    updated_at: now,
    closed_at: null,
    created_by_uid: actorInfo.uid,
    updated_by_uid: actorInfo.uid,
    last_activity_summary: `${actorInfo.name} created this issue`,
    comment_count: 0,
    activity_count: assigneeUids.length > 0 ? 2 : 1,
    checklist_total: template?.checklist.length ?? 0,
    checklist_done: 0,
  });

  const issue = { id: issueRef.id, issue_number: issueNumber, title, project_id: projectId } as IssueWithId;
  await writeActivity(issueRef.id, "created", `${actorInfo.name} created this issue`, actorInfo);

  const uploadedInitialAttachment = await uploadCommentFile(issueRef.id, initialAttachmentFile);
  const initialLinkAttachment = initialAttachmentUrl ? buildLinkAttachment(initialAttachmentUrl, initialAttachmentName) : null;
  const initialAttachments = [uploadedInitialAttachment, initialLinkAttachment].filter(Boolean);

  if (initialAttachments.length > 0) {
    await issueRef.collection("comments").add({
      body: "Initial photo or file link attached during issue creation.",
      attachments: initialAttachments,
      author_uid: actorInfo.uid,
      author_name: actorInfo.name,
      created_at: FieldValue.serverTimestamp(),
      updated_at: null,
    });
    await issueRef.update({
      comment_count: FieldValue.increment(1),
      activity_count: FieldValue.increment(1),
    });
  }

  const initialAssigneeChanges = diffPeople("assignee_uids", [], assigneeUids, userMap);
  if (initialAssigneeChanges.length > 0) {
    const activityId = await writePeopleActivity(issueRef.id, initialAssigneeChanges, actorInfo);
    await notifyPeopleChanges({ issue, actorInfo, changes: initialAssigneeChanges, activityId });
  } else if (watcherUids.length > 1) {
    const watcherChanges = diffPeople("watcher_uids", [], watcherUids.filter((uid) => uid !== actorInfo.uid), userMap);
    if (watcherChanges.length > 0) {
      await writePeopleActivity(issueRef.id, watcherChanges, actorInfo);
    }
  }

  if (template?.checklist.length) {
    await seedChecklist(issueRef.id, template.checklist, actorInfo.uid);
  }

  if (parentIssueId) {
    await writeActivity(parentIssueId, "updated", `${actorInfo.name} added sub-issue ${title}`, actorInfo, {
      after: { sub_issue_id: issueRef.id },
    });
    revalidatePath(`/issues/${parentIssueId}`);
  }

  await recalculateProject(projectId);
  revalidatePath("/issues");
  if (projectId) revalidatePath(`/projects/${projectId}`);
  // Inline flows (e.g. branching from the issue map's side panel) pass
  // stay_on_page so they can keep their current view and refresh in place.
  if (optionalString(formData, "stay_on_page")) {
    return;
  }
  redirect(`/issues/${issueRef.id}`);
}

export async function moveIssueOnBoard(issueId: string, status: IssueStatus) {
  const formData = new FormData();
  formData.set("status", status);
  await updateIssueStatus(issueId, formData);
}

export async function addChecklistItem(issueId: string, formData: FormData) {
  const actorInfo = await actor();
  const title = requiredString(formData, "title");
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const issueData = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, issueData);

  const existing = await issueRef.collection("checklist").orderBy("sort_order", "desc").limit(1).get();
  const sortOrder = existing.empty ? 0 : Number(existing.docs[0].get("sort_order") ?? 0) + 1;

  await issueRef.collection("checklist").add({
    title,
    done: false,
    sort_order: sortOrder,
    created_at: FieldValue.serverTimestamp(),
    created_by_uid: actorInfo.uid,
  });
  await issueRef.update({
    checklist_total: FieldValue.increment(1),
    activity_count: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
    last_activity_summary: `${actorInfo.name} added checklist item`,
  });
  await writeActivity(issueId, "checklist_changed", `${actorInfo.name} added checklist item`, actorInfo, {
    after: { title },
  });
  revalidatePath(`/issues/${issueId}`);
}

export async function toggleChecklistItem(issueId: string, itemId: string, formData: FormData) {
  const actorInfo = await actor();
  const done = formData.get("done") === "on" || formData.get("done") === "true";
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const issueData = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, issueData);

  const itemRef = issueRef.collection("checklist").doc(itemId);
  const item = await itemRef.get();
  if (!item.exists) throw new Error("Checklist item not found.");
  const wasDone = Boolean(item.get("done"));

  await itemRef.update({ done });
  if (wasDone !== done) {
    await issueRef.update({
      checklist_done: FieldValue.increment(done ? 1 : -1),
      activity_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
      last_activity_summary: `${actorInfo.name} ${done ? "completed" : "reopened"} a checklist item`,
    });
    await writeActivity(issueId, "checklist_changed", `${actorInfo.name} ${done ? "completed" : "reopened"} a checklist item`, actorInfo, {
      before: { done: wasDone },
      after: { done },
    });
  }
  revalidatePath(`/issues/${issueId}`);
}

export async function updateIssueAssignees(issueId: string, formData: FormData) {
  const actorInfo = await actor();
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const before = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, before);

  const assigneeUids = values(formData, "assignee_uids");
  const watcherUids = Array.from(new Set([...values(formData, "watcher_uids"), before.created_by_uid]));
  const profiles = await listProfilesForDiff();
  const userMap = buildUserDisplayMap(profiles);

  const changes = [
    ...diffPeople("assignee_uids", before.assignee_uids ?? [], assigneeUids, userMap),
    ...diffPeople("watcher_uids", before.watcher_uids ?? [], watcherUids, userMap),
  ];

  if (changes.length === 0) return;

  const summary = summarizePeopleChanges(actorInfo.name, changes);
  await issueRef.update({
    assignee_uids: assigneeUids,
    watcher_uids: watcherUids,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: summary,
    activity_count: FieldValue.increment(1),
  });

  const activityId = await writePeopleActivity(issueId, changes, actorInfo);
  await notifyPeopleChanges({ issue: before, actorInfo, changes, activityId });

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
  revalidatePath("/inbox");
}

export async function assignIssueToMe(issueId: string) {
  const user = await currentUserOrThrow();
  const actorInfo = {
    uid: user.uid,
    name: user.name ?? user.email ?? "Team member",
    role: user.role,
    storeIds: user.storeIds,
  };
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const before = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueRead(user, before);

  if ((before.assignee_uids ?? []).includes(user.uid)) return;

  const profiles = await listProfilesForDiff();
  const userMap = buildUserDisplayMap(profiles);
  const assigneeUids = Array.from(new Set([...(before.assignee_uids ?? []), user.uid]));
  const changes = diffPeople("assignee_uids", before.assignee_uids ?? [], assigneeUids, userMap);
  const summary = `${actorInfo.name} assigned themselves`;

  await issueRef.update({
    assignee_uids: assigneeUids,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: summary,
    activity_count: FieldValue.increment(1),
  });
  const activityId = await writePeopleActivity(issueId, changes, actorInfo);
  await notifyPeopleChanges({ issue: before, actorInfo, changes, activityId });

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
  revalidatePath("/inbox");
}

export async function setIssueWatching(issueId: string, watching: boolean) {
  const user = await currentUserOrThrow();
  const actorInfo = {
    uid: user.uid,
    name: user.name ?? user.email ?? "Team member",
    role: user.role,
    storeIds: user.storeIds,
  };
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const before = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueRead(user, before);

  const previousWatchers = before.watcher_uids ?? [];
  const watcherUids = watching
    ? Array.from(new Set([...previousWatchers, user.uid]))
    : previousWatchers.filter((uid) => uid !== user.uid);
  const changes = diffPeople("watcher_uids", previousWatchers, watcherUids, buildUserDisplayMap(await listProfilesForDiff()));
  if (changes.length === 0) return;

  const summary = summarizePeopleChanges(actorInfo.name, changes);
  await issueRef.update({
    watcher_uids: watcherUids,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: summary,
    activity_count: FieldValue.increment(1),
  });
  const activityId = await writePeopleActivity(issueId, changes, actorInfo);
  await notifyPeopleChanges({ issue: before, actorInfo, changes, activityId });

  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
  revalidatePath("/inbox");
}

export async function addIssueComment(issueId: string, formData: FormData) {
  const actorInfo = await actor();
  const body = requiredString(formData, "body");
  const attachmentUrl = optionalString(formData, "attachment_url");
  const attachmentName = optionalString(formData, "attachment_name");
  const attachmentFile = formData.get("attachment_file") instanceof File ? (formData.get("attachment_file") as File) : null;
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const issueData = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, issueData);

  const uploadedAttachment = await uploadCommentFile(issueId, attachmentFile);
  const linkAttachment = attachmentUrl ? buildLinkAttachment(attachmentUrl, attachmentName) : null;

  await issueRef.collection("comments").add({
    body,
    attachments: [uploadedAttachment, linkAttachment].filter(Boolean),
    author_uid: actorInfo.uid,
    author_name: actorInfo.name,
    created_at: FieldValue.serverTimestamp(),
    updated_at: null,
  });

  await writeActivity(issueId, "commented", `${actorInfo.name} commented`, actorInfo);
  await issueRef.update({
    comment_count: FieldValue.increment(1),
    activity_count: FieldValue.increment(1),
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: `${actorInfo.name} commented`,
    last_comment_author_name: actorInfo.name,
    last_comment_at: FieldValue.serverTimestamp(),
    last_comment_preview: markdownPreview(body, 160),
  });

  const profiles = await listProfilesForDiff();
  const mentionUsers = buildMentionUsers(profiles);
  const mentionedUids = resolveMentionUids(body, mentionUsers);

  if (mentionedUids.length > 0) {
    const names = profiles
      .filter((p) => mentionedUids.includes(p.uid))
      .map((p) => p.display_name)
      .join(", ");
    await writeActivity(issueId, "mentioned", `${actorInfo.name} mentioned ${names}`, actorInfo, {
      after: { mentioned_uids: mentionedUids },
    });
    await issueRef.update({ activity_count: FieldValue.increment(1) });
  }

  const ref = formatIssueNumber(issueData);
  const title = issueData.title ?? "Issue update";

  if (mentionedUids.length > 0) {
    await queueNotification({
      issueId,
      issueNumber: issueData.issue_number ?? null,
      projectId: issueData.project_id,
      type: "mention",
      actorUid: actorInfo.uid,
      recipientUids: mentionedUids,
      subject: `Mentioned: ${title} ${ref}`,
      body,
    });
  }

  const commentRecipients = [...(issueData.assignee_uids ?? []), ...(issueData.watcher_uids ?? [])].filter(
    (uid) => !mentionedUids.includes(uid)
  );
  if (commentRecipients.length > 0) {
    await queueNotification({
      issueId,
      issueNumber: issueData.issue_number ?? null,
      projectId: issueData.project_id,
      type: "comment",
      actorUid: actorInfo.uid,
      recipientUids: commentRecipients,
      subject: `Comment: ${title} ${ref}`,
      body,
    });
  }

  revalidatePath(`/issues/${issueId}`);
}

export async function updateIssueStatus(issueId: string, formData: FormData) {
  const actorInfo = await actor();
  const status = requiredString(formData, "status") as IssueStatus;
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const before = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, before);
  const closedAt = status === "done" || status === "closed" ? FieldValue.serverTimestamp() : null;
  const summary = `${actorInfo.name} changed status to ${status.replaceAll("_", " ")}`;

  await issueRef.update({
    status,
    closed_at: closedAt,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: summary,
    activity_count: FieldValue.increment(1),
  });
  await writeActivity(issueId, "status_changed", summary, actorInfo, {
    before: { status: before.status },
    after: { status },
  });
  await queueNotification({
    issueId,
    issueNumber: before.issue_number ?? null,
    projectId: before.project_id,
    type: status === "done" || status === "closed" ? "completion" : "status",
    actorUid: actorInfo.uid,
    recipientUids: [...(before.assignee_uids ?? []), ...(before.watcher_uids ?? [])],
    subject: `Status changed: ${before.title ?? "Issue update"} ${formatIssueNumber(before)}`,
    body: summary,
  });

  await recalculateProject(before.project_id);
  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
}

export async function archiveIssue(issueId: string) {
  const actorInfo = await actor();
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const issueData = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, issueData);

  await issueRef.update({
    archived_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: `${actorInfo.name} archived this issue`,
    activity_count: FieldValue.increment(1),
  });
  await writeActivity(issueId, "archived", `${actorInfo.name} archived this issue`, actorInfo);
  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
}

export async function restoreIssue(issueId: string) {
  const actorInfo = await actor();
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const issueData = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, issueData);

  await issueRef.update({
    archived_at: null,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: `${actorInfo.name} restored this issue`,
    activity_count: FieldValue.increment(1),
  });
  await writeActivity(issueId, "restored", `${actorInfo.name} restored this issue`, actorInfo);
  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
}

export async function createProject(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const actorInfo = {
    uid: user.uid,
    name: user.name ?? user.email ?? "Team member",
    role: user.role,
    storeIds: user.storeIds,
  };
  const title = requiredString(formData, "title");
  const now = FieldValue.serverTimestamp();
  const projectRef = await adminDb.collection("projects").add({
    title,
    description: requiredString(formData, "description"),
    status: "active",
    owner_uid: optionalString(formData, "owner_uid"),
    location_ids: values(formData, "location_ids"),
    blocked_reason: optionalString(formData, "blocked_reason"),
    next_step: optionalString(formData, "next_step"),
    issue_count: 0,
    open_issue_count: 0,
    done_issue_count: 0,
    blocked_issue_count: 0,
    due_at: dueDate(formData),
    created_at: now,
    updated_at: now,
    created_by_uid: actorInfo.uid,
  });
  await projectRef.collection("activity").add({
    type: "created",
    actor_uid: actorInfo.uid,
    actor_name: actorInfo.name,
    summary: `${actorInfo.name} created this project`,
    created_at: FieldValue.serverTimestamp(),
  });

  revalidatePath("/projects");
  redirect(`/projects/${projectRef.id}`);
}

export async function createProjectFromTemplate(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const template = getProjectTemplate(requiredString(formData, "template_id"));
  if (!template) throw new Error("Project template not found.");

  const now = FieldValue.serverTimestamp();
  const dueAt = Timestamp.fromDate(new Date(Date.now() + template.due_days * 24 * 60 * 60 * 1000));
  const locationIds = values(formData, "location_ids");
  const ownerUid = optionalString(formData, "owner_uid");
  const projectRef = await adminDb.collection("projects").add({
    title: requiredString(formData, "title"),
    description: template.description,
    status: "active",
    owner_uid: ownerUid,
    location_ids: locationIds,
    blocked_reason: null,
    next_step: `Start ${template.name} playbook`,
    issue_count: template.issues.length,
    open_issue_count: template.issues.length,
    done_issue_count: 0,
    blocked_issue_count: 0,
    due_at: dueAt,
    created_at: now,
    updated_at: now,
    created_by_uid: user.uid,
  });

  await projectRef.collection("activity").add({
    type: "created",
    actor_uid: user.uid,
    actor_name: user.name ?? user.email ?? "Team member",
    summary: `${user.name ?? user.email ?? "Team member"} created project from ${template.name}`,
    created_at: FieldValue.serverTimestamp(),
  });

  for (const issueTemplate of template.issues) {
    const issueNumber = await allocateIssueNumber();
    const issueRef = await adminDb.collection("issues").add({
      issue_number: issueNumber,
      title: issueTemplate.title,
      description: issueTemplate.description,
      kind: issueTemplate.kind,
      status: "open",
      priority: issueTemplate.priority,
      location_id: locationIds[0] ?? null,
      project_id: projectRef.id,
      parent_issue_id: null,
      assignee_uids: ownerUid ? [ownerUid] : [],
      watcher_uids: [user.uid],
      label_ids: [],
      due_at: dueAt,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      closed_at: null,
      archived_at: null,
      created_by_uid: user.uid,
      updated_by_uid: user.uid,
      last_activity_summary: `${user.name ?? user.email ?? "Team member"} created this issue from project template`,
      comment_count: 0,
      activity_count: 1,
      checklist_total: issueTemplate.checklist.length,
      checklist_done: 0,
    });
    await writeActivity(issueRef.id, "created", `${user.name ?? user.email ?? "Team member"} created this issue from project template`, {
      uid: user.uid,
      name: user.name ?? user.email ?? "Team member",
      role: user.role,
      storeIds: user.storeIds,
    });
    await seedChecklist(issueRef.id, issueTemplate.checklist, user.uid);
  }

  revalidatePath("/projects");
  redirect(`/projects/${projectRef.id}`);
}

export async function updateIssueMetadata(issueId: string, formData: FormData) {
  const actorInfo = await actor();
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const before = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, before);

  const projectBefore = before.project_id;
  const projectAfter = optionalString(formData, "project_id");
  const title = formData.has("title") ? requiredString(formData, "title") : before.title;
  const description = formData.has("description") ? requiredString(formData, "description") : before.description;
  const status = requiredString(formData, "status") as IssueStatus;
  const labelIds = values(formData, "label_ids");
  const update = {
    title,
    description,
    kind: requiredString(formData, "kind"),
    status,
    priority: requiredString(formData, "priority") as IssuePriority,
    location_id: optionalString(formData, "location_id"),
    project_id: projectAfter,
    label_ids: labelIds,
    due_at: dueDate(formData),
    blocked_reason: optionalString(formData, "blocked_reason"),
    next_step: optionalString(formData, "next_step"),
    closed_at: status === "done" || status === "closed" ? FieldValue.serverTimestamp() : null,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: `${actorInfo.name} updated issue details`,
    activity_count: FieldValue.increment(1),
  };

  await issueRef.update(update);
  await writeActivity(issueId, "updated", `${actorInfo.name} updated issue details`, actorInfo, {
    before: {
      title: before.title,
      status: before.status,
      priority: before.priority,
      project_id: before.project_id,
    },
    after: {
      title,
      status,
      priority: update.priority,
      project_id: projectAfter,
    },
  });

  await recalculateProject(projectBefore);
  if (projectAfter !== projectBefore) await recalculateProject(projectAfter);
  revalidatePath(`/issues/${issueId}`);
  revalidatePath("/issues");
}

export async function updateIssueDescription(issueId: string, formData: FormData) {
  const actorInfo = await actor();
  const issueRef = adminDb.collection("issues").doc(issueId);
  const issue = await issueRef.get();
  if (!issue.exists) throw new Error("Issue not found.");
  const before = { id: issue.id, ...issue.data() } as IssueWithId;
  requireIssueWrite({ uid: actorInfo.uid, role: actorInfo.role, storeIds: actorInfo.storeIds, email: null, name: actorInfo.name }, before);

  const description = requiredString(formData, "description");
  await issueRef.update({
    description,
    updated_at: FieldValue.serverTimestamp(),
    updated_by_uid: actorInfo.uid,
    last_activity_summary: `${actorInfo.name} updated the description`,
    activity_count: FieldValue.increment(1),
  });
  await writeActivity(issueId, "updated", `${actorInfo.name} updated the description`, actorInfo, {
    before: { description: before.description },
    after: { description },
  });
  revalidatePath(`/issues/${issueId}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const due = dueDate(formData);
  await adminDb.collection("projects").doc(projectId).update({
    title: requiredString(formData, "title"),
    description: requiredString(formData, "description"),
    status: requiredString(formData, "status"),
    owner_uid: optionalString(formData, "owner_uid"),
    location_ids: values(formData, "location_ids"),
    blocked_reason: optionalString(formData, "blocked_reason"),
    next_step: optionalString(formData, "next_step"),
    due_at: due,
    updated_at: FieldValue.serverTimestamp(),
  });
  await adminDb.collection("projects").doc(projectId).collection("activity").add({
    type: "updated",
    actor_uid: user.uid,
    actor_name: user.name ?? user.email ?? "Team member",
    summary: `${user.name ?? user.email ?? "Team member"} updated this project`,
    created_at: FieldValue.serverTimestamp(),
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function upsertLocation(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  await adminDb.collection("locations").doc(id).set(
    {
      name: requiredString(formData, "name"),
      code: requiredString(formData, "code"),
      kind: requiredString(formData, "kind"),
      active: formData.get("active") === "on",
      sort_order: Number(formData.get("sort_order") ?? 999),
    },
    { merge: true }
  );
  revalidatePath("/admin");
  revalidatePath("/issues");
  redirect(`/admin?editLocation=${id}#locations`);
}

export async function upsertLabel(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  await adminDb.collection("labels").doc(id).set(
    {
      name: requiredString(formData, "name"),
      color: requiredString(formData, "color"),
      description: optionalString(formData, "description") ?? "",
    },
    { merge: true }
  );
  revalidatePath("/admin");
  revalidatePath("/issues");
  redirect(`/admin?editLabel=${id}#labels`);
}

export async function upsertUserProfile(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const uid = requiredString(formData, "uid");
  const storeIds = values(formData, "store_ids");
  const role = requiredString(formData, "role") as UserProfile["role"];
  const profile = {
    uid,
    email: optionalString(formData, "email"),
    display_name: requiredString(formData, "display_name"),
    role,
    store_ids: storeIds,
    store_id: storeIds[0] ?? null,
    active: formData.get("active") === "on",
    notification_email: formData.get("notification_email") === "on",
    notification_slack: formData.get("notification_slack") === "on",
    updated_at: FieldValue.serverTimestamp(),
    created_at: FieldValue.serverTimestamp(),
  };
  await adminDb.collection("userProfiles").doc(uid).set(profile, { merge: true });
  const claims = await syncUserAuthClaims(uid, profile);
  revalidatePath("/admin");
  const claimsParam = claims.synced ? "" : "&claims=auth_missing";
  redirect(`/admin?editUser=${uid}${claimsParam}#users`);
}

export async function markNotificationRead(notificationId: string) {
  const user = await currentUserOrThrow();
  const ref = adminDb.collection("notificationInbox").doc(notificationId);
  const doc = await ref.get();
  if (!doc.exists || doc.get("uid") !== user.uid) throw new Error("Notification not found.");
  await ref.update({ read: true, read_at: FieldValue.serverTimestamp() });
  revalidatePath("/inbox");
}

export async function markAllNotificationsRead() {
  const user = await currentUserOrThrow();
  const snapshot = await adminDb.collection("notificationInbox").where("uid", "==", user.uid).where("read", "==", false).get();
  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => batch.update(doc.ref, { read: true, read_at: FieldValue.serverTimestamp() }));
  await batch.commit();
  revalidatePath("/inbox");
}

export async function markIssueNotificationsRead(issueId: string) {
  const user = await currentUserOrThrow();
  const snapshot = await adminDb
    .collection("notificationInbox")
    .where("uid", "==", user.uid)
    .where("issue_id", "==", issueId)
    .where("read", "==", false)
    .get();
  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => batch.update(doc.ref, { read: true, read_at: FieldValue.serverTimestamp() }));
  await batch.commit();
  revalidatePath("/inbox");
}

export async function updateNotificationPreferences(formData: FormData) {
  const user = await currentUserOrThrow();
  await adminDb.collection("notificationPreferences").doc(user.uid).set(
    {
      uid: user.uid,
      default_view: optionalString(formData, "default_view") ?? "inbox",
      density: optionalString(formData, "density") ?? "comfortable",
      digest_mode: formData.get("digest_mode") === "on",
      notification_email: formData.get("notification_email") === "on",
      notification_slack: formData.get("notification_slack") === "on",
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  revalidatePath("/inbox");
}

export async function createTestNotification(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const recipientUid = requiredString(formData, "recipient_uid");
  const channel = optionalString(formData, "channel") ?? "email";
  const issueId = optionalString(formData, "issue_id") ?? "test-notification";
  const subject = optionalString(formData, "subject") ?? "Seoul Bowl Ops test notification";
  const body = optionalString(formData, "body") ?? "This is a test notification from the Ops admin page.";

  await adminDb.collection("notificationEvents").add({
    issue_id: issueId,
    project_id: null,
    type: "mention",
    actor_uid: user.uid,
    recipient_uids: [recipientUid],
    channel,
    subject,
    body,
    status: "pending",
    created_at: FieldValue.serverTimestamp(),
    processed_at: null,
  });

  await adminDb.collection("notificationInbox").add({
    uid: recipientUid,
    issue_id: issueId,
    issue_number: null,
    project_id: null,
    type: "mention",
    change_type: null,
    activity_id: null,
    subject,
    body,
    read: false,
    read_at: null,
    created_at: FieldValue.serverTimestamp(),
  });

  revalidatePath("/admin");
  revalidatePath("/inbox");
}

export async function submitPilotFeedback(formData: FormData) {
  const user = await currentUserOrThrow();
  await adminDb.collection("pilotFeedback").add({
    uid: user.uid,
    role: user.role,
    store_ids: user.storeIds,
    scenario: requiredString(formData, "scenario"),
    rating: Number(formData.get("rating") ?? 3),
    worked_well: optionalString(formData, "worked_well") ?? "",
    friction: optionalString(formData, "friction") ?? "",
    still_used_outside_tool: optionalString(formData, "still_used_outside_tool") ?? "",
    created_at: FieldValue.serverTimestamp(),
  });
  revalidatePath("/pilot");
  redirect("/pilot?submitted=1");
}

export async function upsertRecurringTemplate(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = optionalString(formData, "id") ?? randomUUID();
  const cadence = requiredString(formData, "cadence");
  const nextRunRaw = requiredString(formData, "next_run_at");
  const existing = await adminDb.collection("recurringTemplates").doc(id).get();
  await adminDb.collection("recurringTemplates").doc(id).set(
    {
      name: requiredString(formData, "name"),
      template_id: requiredString(formData, "template_id"),
      active: formData.get("active") === "on",
      cadence,
      next_run_at: Timestamp.fromDate(new Date(`${nextRunRaw}T08:00:00`)),
      due_days: Number(formData.get("due_days") ?? 7),
      default_location_id: optionalString(formData, "default_location_id"),
      created_by_uid: existing.exists ? existing.get("created_by_uid") : user.uid,
      created_at: existing.exists ? existing.get("created_at") : FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  revalidatePath("/admin");
  redirect("/admin#automation");
}

export async function deleteLocation(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  const hardDelete = formData.get("hard_delete") === "true";

  if (hardDelete) {
    const linked = await adminDb.collection("issues").where("location_id", "==", id).limit(1).get();
    if (!linked.empty) {
      throw new Error("Cannot delete a location that still has issues. Deactivate it instead.");
    }
    await adminDb.collection("locations").doc(id).delete();
  } else {
    await adminDb.collection("locations").doc(id).set({ active: false }, { merge: true });
  }
  revalidatePath("/admin");
  revalidatePath("/issues");
  redirect("/admin#locations");
}

export async function deleteLabel(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  await adminDb.collection("labels").doc(id).delete();
  revalidatePath("/admin");
  revalidatePath("/issues");
  redirect("/admin#labels");
}

export async function deactivateUserProfile(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const uid = requiredString(formData, "uid");
  if (uid === user.uid) throw new Error("You cannot deactivate your own account.");
  await adminDb.collection("userProfiles").doc(uid).set(
    {
      active: false,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  revalidatePath("/admin");
  redirect("/admin#users");
}

export async function deleteRecurringTemplate(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  await adminDb.collection("recurringTemplates").doc(id).delete();
  revalidatePath("/admin");
  redirect("/admin#automation");
}

export async function retryNotificationEvent(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  await adminDb.collection("notificationEvents").doc(id).update({
    status: "pending",
    processed_at: null,
    updated_at: FieldValue.serverTimestamp(),
  });
  revalidatePath("/admin");
  redirect("/admin#notifications");
}

export async function dismissNotificationEvent(formData: FormData) {
  const user = await currentUserOrThrow();
  requireAdminRole(user);
  const id = requiredString(formData, "id");
  await adminDb.collection("notificationEvents").doc(id).update({
    status: "dismissed",
    processed_at: FieldValue.serverTimestamp(),
  });
  revalidatePath("/admin");
  redirect("/admin#notifications");
}

export async function recalculateProject(projectId: string | null) {
  if (!projectId) return;
  const snapshot = await adminDb.collection("issues").where("project_id", "==", projectId).get();
  let open = 0;
  let done = 0;
  let blocked = 0;
  let total = 0;
  for (const doc of snapshot.docs) {
    if (doc.get("archived_at")) continue;
    total += 1;
    const status = doc.get("status") as IssueStatus;
    if (status === "done" || status === "closed") done += 1;
    else open += 1;
    if (status === "blocked") blocked += 1;
  }
  await adminDb.collection("projects").doc(projectId).update({
    issue_count: total,
    open_issue_count: open,
    done_issue_count: done,
    blocked_issue_count: blocked,
    updated_at: FieldValue.serverTimestamp(),
  });
}
