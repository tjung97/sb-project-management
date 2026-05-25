import { config } from "dotenv";

config({ path: ".env.local" });

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp({
    credential: serviceAccountKey ? cert(JSON.parse(serviceAccountKey) as Record<string, string>) : applicationDefault(),
  });
}

const db = getFirestore();

async function main() {
  const issues = await db.collection("issues").orderBy("created_at", "asc").get();
  const counterRef = db.collection("counters").doc("issues");
  const counter = await counterRef.get();
  let nextIssueNumber = Number(counter.data()?.value ?? 0);
  let migrated = 0;

  for (const issue of issues.docs) {
    const data = issue.data();
    const update: Record<string, unknown> = {};

    if (!data.issue_number) {
      nextIssueNumber += 1;
      update.issue_number = nextIssueNumber;
    }
    if (!("parent_issue_id" in data)) update.parent_issue_id = null;
    if (!("checklist_total" in data)) update.checklist_total = 0;
    if (!("checklist_done" in data)) update.checklist_done = 0;
    if (!("archived_at" in data)) update.archived_at = null;

    if (Object.keys(update).length > 0) {
      update.updated_at = data.updated_at ?? FieldValue.serverTimestamp();
      await issue.ref.set(update, { merge: true });
      migrated += 1;
      console.log(`Migrated issue ${issue.id}`, update);
    }
  }

  await counterRef.set({ value: nextIssueNumber }, { merge: true });
  console.log(`Migration complete. Migrated ${migrated} issues. Next issue counter is ${nextIssueNumber}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
