import { config } from "dotenv";

config({ path: ".env.local" });

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { DEFAULT_LABELS } from "../src/lib/ops/constants";
import { markdownPreview } from "../src/lib/ops/format";

if (getApps().length === 0) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp({
    credential: serviceAccountKey
      ? cert(JSON.parse(serviceAccountKey) as Record<string, string>)
      : applicationDefault(),
  });
}

const db = getFirestore();

const locations = [
  { id: "global", name: "All Seoul Bowl", code: "GLOBAL", kind: "global", active: true, sort_order: 0 },
  { id: "hq", name: "HQ", code: "HQ", kind: "hq", active: true, sort_order: 10 },
  { id: "warehouse", name: "Warehouse", code: "WH", kind: "warehouse", active: true, sort_order: 20 },
  { id: "office", name: "Office", code: "OFFICE", kind: "office", active: true, sort_order: 30 },
  { id: "seattle", name: "Seattle Store", code: "SEA", kind: "store", active: true, sort_order: 100 },
  { id: "bellevue", name: "Bellevue Store", code: "BEL", kind: "store", active: true, sort_order: 110 },
] as const;

const now = new Date();
const due = (days: number) => Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12));

const team = [
  {
    uid: "seed-hq-ops",
    email: "ops@seoulbowl.com",
    display_name: "HQ Ops",
    role: "admin",
    store_ids: [] as string[],
    store_id: null,
  },
  {
    uid: "seed-warehouse",
    email: "warehouse@seoulbowl.com",
    display_name: "Warehouse Lead",
    role: "member",
    store_ids: ["warehouse"],
    store_id: "warehouse",
  },
  {
    uid: "seed-seattle-manager",
    email: "seattle.manager@seoulbowl.com",
    display_name: "Seattle Manager",
    role: "manager",
    store_ids: ["seattle", "bellevue"],
    store_id: "seattle",
  },
  {
    uid: "seed-bellevue-manager",
    email: "bellevue.manager@seoulbowl.com",
    display_name: "Bellevue Manager",
    role: "manager",
    store_ids: ["bellevue"],
    store_id: "bellevue",
  },
] as const;

const projects = [
  {
    id: "ops-foundation",
    title: "Ops foundation",
    description: "Baseline operating system for making Seoul Bowl follow-ups visible, assigned, discussed, and closed.",
    owner_uid: "seed-hq-ops",
    location_ids: ["global", "hq", "warehouse"],
    due_at: due(14),
  },
  {
    id: "new-store-readiness",
    title: "New store readiness",
    description: "Everything needed before a new store or sign setup goes live: vendors, signage, training, equipment, and checklists.",
    owner_uid: "seed-hq-ops",
    location_ids: ["global", "office"],
    due_at: due(30),
  },
  {
    id: "warehouse-cleanup",
    title: "Warehouse cleanup and ordering flow",
    description: "Improve warehouse visibility, reduce missing supplies, and make store requests easier to track.",
    owner_uid: "seed-warehouse",
    location_ids: ["warehouse", "seattle", "bellevue"],
    due_at: due(21),
  },
] as const;

const issues = [
  {
    id: "sign-vendor-followup",
    title: "Follow up with sign vendor on install date",
    description:
      "Vendor replied in email but no install date is confirmed. Need one owner to call, record date, and attach next steps for payment/photo verification.",
    kind: "email",
    status: "in_progress",
    priority: "urgent",
    location_id: "global",
    project_id: "new-store-readiness",
    assignee_uids: ["seed-hq-ops"],
    watcher_uids: ["seed-seattle-manager"],
    label_ids: ["follow-up", "vendor", "urgent"],
    due_at: due(1),
    comments: [
      "Vendor said artwork is approved. Waiting on install window.",
      "Please update this issue after the call so store managers can see the real date.",
    ],
  },
  {
    id: "seattle-prep-sink-leak",
    title: "Seattle prep sink is leaking under the left basin",
    description:
      "Manager reported water under prep sink during close. Need photo, plumber quote, repair window, and confirmation that opening prep is not impacted.",
    kind: "fix",
    status: "blocked",
    priority: "high",
    location_id: "seattle",
    project_id: "ops-foundation",
    assignee_uids: ["seed-seattle-manager"],
    watcher_uids: ["seed-hq-ops"],
    label_ids: ["maintenance", "store"],
    due_at: due(-1),
    comments: [
      "Photo uploaded in team chat. Moving here so it does not get lost.",
      "Blocked until plumber confirms quote and earliest visit.",
    ],
  },
  {
    id: "warehouse-rice-count",
    title: "Reconcile rice inventory count before Monday ordering",
    description:
      "Warehouse count and store par requests do not match. Confirm bags on hand, expected deliveries, and whether Seattle/Bellevue need emergency transfer.",
    kind: "warehouse",
    status: "open",
    priority: "high",
    location_id: "warehouse",
    project_id: "warehouse-cleanup",
    assignee_uids: ["seed-warehouse"],
    watcher_uids: ["seed-hq-ops", "seed-seattle-manager", "seed-bellevue-manager"],
    label_ids: ["vendor", "urgent"],
    due_at: due(2),
    comments: ["Need final number before placing Monday purchase order."],
  },
  {
    id: "bellevue-training-checklist",
    title: "Create Bellevue closing checklist for new shift leads",
    description:
      "Staff keep asking the same closing questions. Turn the current notes into a repeatable checklist with photos for trash, sauce station, and register close.",
    kind: "store_work",
    status: "in_progress",
    priority: "normal",
    location_id: "bellevue",
    project_id: "ops-foundation",
    assignee_uids: ["seed-bellevue-manager"],
    watcher_uids: ["seed-hq-ops"],
    label_ids: ["store", "follow-up"],
    due_at: due(7),
    comments: ["Start with the checklist from Seattle, but remove store-specific equipment names."],
  },
  {
    id: "office-insurance-renewal",
    title: "Confirm insurance renewal documents are filed",
    description:
      "Renewal email came in last week. Need to confirm signed docs, save PDF in drive, and add next renewal reminder.",
    kind: "office_work",
    status: "open",
    priority: "normal",
    location_id: "office",
    project_id: "ops-foundation",
    assignee_uids: ["seed-hq-ops"],
    watcher_uids: [],
    label_ids: ["follow-up"],
    due_at: due(5),
    comments: [],
  },
  {
    id: "sample-sign-onboarding",
    title: "New store sign onboarding checklist",
    description:
      "Create a repeatable checklist for sign vendor contact, artwork approval, payment, install date, and post-install photo follow-up.",
    kind: "onboarding",
    status: "done",
    priority: "high",
    location_id: "global",
    project_id: "new-store-readiness",
    assignee_uids: ["seed-hq-ops"],
    watcher_uids: ["seed-seattle-manager", "seed-bellevue-manager"],
    label_ids: ["follow-up", "vendor"],
    due_at: due(3),
    comments: ["Checklist created. Next use it for the upcoming sign install."],
  },
] as const;

async function main() {
  const batch = db.batch();

  for (const location of locations) {
    batch.set(db.collection("locations").doc(location.id), location, { merge: true });
  }

  for (const label of DEFAULT_LABELS) {
    batch.set(db.collection("labels").doc(label.id), label, { merge: true });
  }

  for (const user of team) {
    batch.set(
      db.collection("userProfiles").doc(user.uid),
      {
        ...user,
        active: true,
        notification_email: true,
        notification_slack: false,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  for (const project of projects) {
    const projectIssues = issues.filter((issue) => issue.project_id === project.id);
    batch.set(
      db.collection("projects").doc(project.id),
      {
        title: project.title,
        description: project.description,
        status: "active",
        owner_uid: project.owner_uid,
        location_ids: project.location_ids,
        issue_count: projectIssues.length,
        open_issue_count: projectIssues.filter((issue) => !["done", "closed"].includes(issue.status)).length,
        done_issue_count: projectIssues.filter((issue) => ["done", "closed"].includes(issue.status)).length,
        blocked_issue_count: projectIssues.filter((issue) => issue.status === "blocked").length,
        due_at: project.due_at,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        created_by_uid: "seed-hq-ops",
      },
      { merge: true }
    );
  }

  let issueNumber = 0;
  for (const issue of issues) {
    issueNumber += 1;
    const issueRef = db.collection("issues").doc(issue.id);
    const lastCommentIndex = issue.comments.length - 1;
    const lastCommentAuthor = lastCommentIndex >= 0 ? team[lastCommentIndex % team.length] : null;
    const lastCommentBody = lastCommentIndex >= 0 ? issue.comments[lastCommentIndex] : null;
    batch.set(
      issueRef,
      {
        issue_number: issueNumber,
        title: issue.title,
        description: issue.description,
        kind: issue.kind,
        status: issue.status,
        priority: issue.priority,
        location_id: issue.location_id,
        project_id: issue.project_id,
        assignee_uids: issue.assignee_uids,
        watcher_uids: issue.watcher_uids,
        label_ids: issue.label_ids,
        due_at: issue.due_at,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
        closed_at: ["done", "closed"].includes(issue.status) ? FieldValue.serverTimestamp() : null,
        created_by_uid: "seed-hq-ops",
        updated_by_uid: issue.assignee_uids[0] ?? "seed-hq-ops",
        last_activity_summary:
          lastCommentAuthor && lastCommentBody
            ? `${lastCommentAuthor.display_name} commented`
            : issue.status === "blocked"
              ? "Blocked waiting on outside confirmation"
              : "Seeded realistic operations activity",
        last_comment_author_name: lastCommentAuthor?.display_name ?? null,
        last_comment_at: lastCommentBody ? FieldValue.serverTimestamp() : null,
        last_comment_preview: lastCommentBody ? markdownPreview(lastCommentBody, 160) : null,
        comment_count: issue.comments.length,
        activity_count: issue.comments.length + 1,
        parent_issue_id: null,
        checklist_total: 0,
        checklist_done: 0,
      },
      { merge: true }
    );

    batch.set(issueRef.collection("activity").doc("seed-created"), {
      type: "created",
      actor_uid: "seed-hq-ops",
      actor_name: "HQ Ops",
      summary: "HQ Ops opened this operational issue",
      created_at: FieldValue.serverTimestamp(),
    });

    if (issue.assignee_uids.length > 0) {
      batch.set(issueRef.collection("activity").doc("seed-assigned"), {
        type: "assigned",
        actor_uid: "seed-hq-ops",
        actor_name: "HQ Ops",
        summary: `HQ Ops assigned ${issue.assignee_uids.map((uid) => team.find((member) => member.uid === uid)?.display_name ?? "team member").join(", ")}`,
        changes: issue.assignee_uids.map((uid) => ({
          field: "assignee_uids",
          op: "added",
          uid,
          display_name: team.find((member) => member.uid === uid)?.display_name ?? "Team member",
        })),
        created_at: FieldValue.serverTimestamp(),
      });
    }

    issue.comments.forEach((comment, index) => {
      const author = team[index % team.length];
      batch.set(issueRef.collection("comments").doc(`seed-comment-${index + 1}`), {
        body: comment,
        author_uid: author.uid,
        author_name: author.display_name,
        created_at: FieldValue.serverTimestamp(),
        updated_at: null,
      });
      batch.set(issueRef.collection("activity").doc(`seed-comment-${index + 1}`), {
        type: "commented",
        actor_uid: author.uid,
        actor_name: author.display_name,
        summary: `${author.display_name} commented`,
        created_at: FieldValue.serverTimestamp(),
      });
    });
  }

  batch.set(db.collection("counters").doc("issues"), { value: issueNumber }, { merge: true });

  await batch.commit();
  console.log(`Seeded ${projects.length} projects, ${issues.length} issues (#1–#${issueNumber}), ${locations.length} locations, and ${team.length} demo team profiles.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
