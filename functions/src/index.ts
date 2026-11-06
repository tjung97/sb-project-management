import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { dueDateFromDays, RECURRING_ISSUE_TEMPLATES } from "./recurring.js";

initializeApp();

const db = getFirestore();
const auth = getAuth();

interface NotificationEvent {
  issue_id: string;
  type: string;
  actor_uid: string;
  recipient_uids: string[];
  channel: "email" | "slack" | "both";
  subject: string;
  body: string;
}

interface RecurringTemplate {
  name: string;
  template_id: string;
  active: boolean;
  cadence: "weekly" | "monthly";
  next_run_at: FirebaseFirestore.Timestamp;
  default_location_id?: string | null;
  due_days?: number | null;
}

export const processNotificationEvent = onDocumentCreated(
  {
    document: "notificationEvents/{eventId}",
    region: "us-west1",
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data() as NotificationEvent;
    try {
      const recipients = await resolveRecipientEmails(data.recipient_uids);
      if (recipients.length === 0) {
        await snapshot.ref.update({
          status: "skipped",
          processed_at: FieldValue.serverTimestamp(),
          error: "No recipient emails found.",
        });
        return;
      }

      if (data.channel === "email" || data.channel === "both") {
        await sendEmail({
          to: recipients,
          subject: data.subject,
          text: `${data.body}\n\nOpen issue: ${appUrl()}/issues/${data.issue_id}`,
        });
      }

      if (data.channel === "slack" || data.channel === "both") {
        const issue = await db.collection("issues").doc(data.issue_id).get();
        await sendSlack(`${data.subject}\n${data.body}\n${appUrl()}/issues/${data.issue_id}`, {
          locationId: issue.get("location_id") as string | null | undefined,
          kind: issue.get("kind") as string | undefined,
        });
      }

      await snapshot.ref.update({
        status: "sent",
        processed_at: FieldValue.serverTimestamp(),
      });
      await db.collection("issues").doc(data.issue_id).collection("activity").add({
        type: "notification_sent",
        actor_uid: data.actor_uid,
        actor_name: "Notification system",
        summary: `Sent notification to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
        notification_event_id: snapshot.id,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error("Notification failed", error);
      await snapshot.ref.update({
        status: "failed",
        processed_at: FieldValue.serverTimestamp(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
);

export const generateRecurringIssues = onSchedule(
  {
    schedule: "every day 07:00",
    timeZone: "America/Los_Angeles",
    region: "us-west1",
  },
  async () => {
    const now = new Date();
    const snapshot = await db
      .collection("recurringTemplates")
      .where("active", "==", true)
      .where("next_run_at", "<=", now)
      .get();

    for (const doc of snapshot.docs) {
      const recurring = doc.data() as RecurringTemplate;
      const template = RECURRING_ISSUE_TEMPLATES[recurring.template_id];
      if (!template) {
        logger.warn("Recurring template references unknown issue template", { id: doc.id, templateId: recurring.template_id });
        continue;
      }

      const issueNumber = await allocateIssueNumber();
      const dueAt = dueDateFromDays(now, recurring.due_days ?? template.due_days);
      const issueRef = await db.collection("issues").add({
        issue_number: issueNumber,
        title: `${template.title} (${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(now)})`,
        description: template.description,
        kind: template.kind,
        status: "open",
        priority: template.priority,
        location_id: recurring.default_location_id ?? null,
        project_id: null,
        parent_issue_id: null,
        assignee_uids: [],
        watcher_uids: [],
        label_ids: template.label_ids,
        due_at: dueAt,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        closed_at: null,
        archived_at: null,
        created_by_uid: "automation",
        updated_by_uid: "automation",
        last_activity_summary: "Recurring automation created this issue",
        comment_count: 0,
        activity_count: 1,
        checklist_total: template.checklist.length,
        checklist_done: 0,
      });

      const batch = db.batch();
      batch.set(issueRef.collection("activity").doc(), {
        type: "created",
        actor_uid: "automation",
        actor_name: "Recurring automation",
        summary: "Recurring automation created this issue",
        created_at: FieldValue.serverTimestamp(),
      });
      template.checklist.forEach((title, index) => {
        batch.set(issueRef.collection("checklist").doc(), {
          title,
          done: false,
          sort_order: index,
          created_at: FieldValue.serverTimestamp(),
          created_by_uid: "automation",
        });
      });
      await batch.commit();

      await doc.ref.update({
        next_run_at: nextRunDate(now, recurring.cadence),
        updated_at: FieldValue.serverTimestamp(),
      });
    }
  }
);

export const sendDailyDigest = onSchedule(
  {
    schedule: "every day 08:00",
    timeZone: "America/Los_Angeles",
    region: "us-west1",
  },
  async () => {
    const profiles = await db.collection("userProfiles").where("notification_email", "==", true).get();
    const openIssues = await db.collection("issues").where("status", "in", ["open", "in_progress", "blocked"]).limit(200).get();
    const blocked = openIssues.docs.filter((doc) => doc.get("status") === "blocked").length;
    const unassigned = openIssues.docs.filter((doc) => ((doc.get("assignee_uids") as string[] | undefined) ?? []).length === 0).length;
    const dueSoon = openIssues.docs.filter((doc) => {
      const due = doc.get("due_at") as FirebaseFirestore.Timestamp | null;
      if (!due) return false;
      return due.toMillis() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
    }).length;

    const text = [
      "Seoul Bowl Ops daily digest",
      `Open: ${openIssues.size}`,
      `Blocked: ${blocked}`,
      `Unassigned: ${unassigned}`,
      `Due this week: ${dueSoon}`,
      `${appUrl()}/inbox`,
    ].join("\n");

    const emails = profiles.docs
      .filter((doc) => doc.get("digest_mode") !== false)
      .map((doc) => doc.get("email") as string | undefined)
      .filter((email): email is string => Boolean(email));
    if (emails.length) {
      await sendEmail({ to: emails, subject: "Seoul Bowl Ops daily digest", text });
    }
  }
);

// Triggers the no-show check on the deployed app every 15 min during operating
// hours (covers every shift's start time, not just the opener). The app route
// does the Sling+Toast detection, de-dupes, and posts to Slack.
export const noShowCheck = onSchedule(
  {
    schedule: "*/15 6-22 * * *",
    timeZone: "America/Los_Angeles",
    region: "us-west1",
  },
  async () => {
    const secret = process.env.CRON_SECRET;
    const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
    if (!secret || !base) {
      logger.warn("noShowCheck: APP_URL or CRON_SECRET not set; skipping.");
      return;
    }
    try {
      const res = await fetch(`${base}/api/cron/no-show?notify=1&key=${encodeURIComponent(secret)}`);
      const data = (await res.json().catch(() => ({}))) as { totals?: { noShows?: number }; notified?: { posted?: number } };
      logger.info("noShowCheck ran", {
        status: res.status,
        noShows: data.totals?.noShows ?? null,
        posted: data.notified?.posted ?? null,
      });
    } catch (err) {
      logger.error("noShowCheck failed", { error: (err as Error).message });
    }
  }
);

// Ticks the out-of-stock → Sling alert every 15 min. The app route reads the
// send time/days/chats from Firestore (Operations tab) and only sends once per
// day at the configured time, so changing the time needs no redeploy.
export const outOfStockAlert = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "America/Los_Angeles",
    region: "us-west1",
  },
  async () => {
    const secret = process.env.CRON_SECRET;
    const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
    if (!secret || !base) {
      logger.warn("outOfStockAlert: APP_URL or CRON_SECRET not set; skipping.");
      return;
    }
    try {
      const res = await fetch(`${base}/api/cron/out-of-stock?key=${encodeURIComponent(secret)}`);
      const data = (await res.json().catch(() => ({}))) as { status?: string; reason?: string | null; posted?: number; errors?: string[] };
      const log = data.status === "failed" || data.status === "partial" ? logger.error : logger.info;
      log("outOfStockAlert ran", { http: res.status, status: data.status, reason: data.reason, posted: data.posted, errors: data.errors });
    } catch (err) {
      logger.error("outOfStockAlert failed", { error: (err as Error).message });
    }
  }
);

export const escalateStaleWork = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "America/Los_Angeles",
    region: "us-west1",
  },
  async () => {
    const now = Date.now();
    const issues = await db.collection("issues").where("status", "in", ["open", "in_progress", "blocked"]).limit(300).get();
    const admins = await db.collection("userProfiles").where("active", "==", true).where("role", "==", "admin").get();
    const adminUids = admins.docs.map((doc) => doc.get("uid") as string).filter(Boolean);
    if (adminUids.length === 0) {
      logger.info("No admins configured for stale work escalation.");
      return;
    }

    for (const issue of issues.docs) {
      const data = issue.data();
      const updatedAt = data.updated_at as FirebaseFirestore.Timestamp | undefined;
      if (!updatedAt) continue;
      const ageMs = now - updatedAt.toMillis();
      const assignees = (data.assignee_uids as string[] | undefined) ?? [];
      const staleUnassigned = assignees.length === 0 && ageMs >= 48 * 60 * 60 * 1000;
      const staleBlocked = data.status === "blocked" && ageMs >= 72 * 60 * 60 * 1000;
      if (!staleUnassigned && !staleBlocked) continue;

      const escalationKey = staleUnassigned ? "unassigned_48h" : "blocked_72h";
      const alreadySent = await db
        .collection("notificationInbox")
        .where("issue_id", "==", issue.id)
        .where("change_type", "==", escalationKey)
        .limit(1)
        .get();
      if (!alreadySent.empty) continue;

      const subject = staleUnassigned ? `Unassigned 48h+: ${data.title}` : `Blocked 72h+: ${data.title}`;
      const body = staleUnassigned
        ? "This issue has been unassigned for more than 48 hours."
        : "This issue has been blocked for more than 72 hours.";
      const batch = db.batch();
      for (const uid of adminUids) {
        batch.set(db.collection("notificationInbox").doc(), {
          uid,
          issue_id: issue.id,
          issue_number: data.issue_number ?? null,
          project_id: data.project_id ?? null,
          type: "status",
          change_type: escalationKey,
          activity_id: null,
          subject,
          body,
          read: false,
          read_at: null,
          created_at: FieldValue.serverTimestamp(),
        });
      }
      batch.set(issue.ref.collection("activity").doc(), {
        type: "notification_sent",
        actor_uid: "automation",
        actor_name: "Escalation automation",
        summary: body,
        created_at: FieldValue.serverTimestamp(),
      });
      await batch.commit();
    }
  }
);

async function resolveRecipientEmails(uids: string[]) {
  const emails = await Promise.all(
    Array.from(new Set(uids)).map(async (uid) => {
      const profile = await db.collection("userProfiles").doc(uid).get();
      const profileEmail = profile.get("email") as string | undefined;
      if (profile.exists && profile.get("notification_email") === false) return null;
      if (profileEmail) return profileEmail;
      try {
        const user = await auth.getUser(uid);
        return user.email ?? null;
      } catch {
        return null;
      }
    })
  );
  return emails.filter((email): email is string => Boolean(email));
}

async function sendEmail(input: { to: string[]; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.info("RESEND_API_KEY not set; logging email instead.", input);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Seoul Bowl Ops <ops@seoulbowl.com>",
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }
}

async function sendSlack(text: string, context: { locationId?: string | null; kind?: string }) {
  const routeKey = context.locationId ? `SLACK_WEBHOOK_${context.locationId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : null;
  const kindKey = context.kind ? `SLACK_WEBHOOK_${context.kind.toUpperCase().replace(/[^A-Z0-9]/g, "_")}` : null;
  const webhookUrl = (routeKey ? process.env[routeKey] : undefined) ?? (kindKey ? process.env[kindKey] : undefined) ?? process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.info("SLACK_WEBHOOK_URL not set; skipping Slack notification.");
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`);
  }
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

async function allocateIssueNumber() {
  const counterRef = db.collection("counters").doc("issues");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.exists ? Number(snap.data()?.value ?? 0) : 0) + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
}

function nextRunDate(from: Date, cadence: "weekly" | "monthly") {
  const next = new Date(from);
  if (cadence === "weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  next.setHours(8, 0, 0, 0);
  return next;
}
