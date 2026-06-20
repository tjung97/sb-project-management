/**
 * Sets the `role: admin` custom claim directly on a real Firebase Auth user,
 * keyed by email. This is the source of truth the Firestore security rules
 * check (`request.auth.token.role`), so a client SDK app (e.g. the iOS app)
 * can read data the rules gate on admin.
 *
 * Usage:
 *   npx tsx scripts/set-admin-claim.ts you@example.com
 *   npx tsx scripts/set-admin-claim.ts you@example.com store-a,store-b   # optional storeIds
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in .env.local (already present).
 */
import { config } from "dotenv";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

config({ path: ".env.local" });

const email = process.argv[2];
const storeIds = (process.argv[3] ?? "").split(",").map((s) => s.trim()).filter(Boolean);

if (!email) {
  console.error("Usage: npx tsx scripts/set-admin-claim.ts <email> [storeId1,storeId2]");
  process.exit(1);
}

const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!key) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is missing from .env.local");
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(JSON.parse(key) as Record<string, string>) });
}

const auth = getAuth();
const db = getFirestore();

async function main() {
  const user = await auth.getUserByEmail(email);
  console.log(`Found Auth user: uid=${user.uid} email=${user.email}`);

  // Set the custom claims the rules check.
  await auth.setCustomUserClaims(user.uid, {
    role: "admin",
    storeIds,
    storeId: storeIds[0] ?? null,
  });
  console.log(`✓ Set custom claims: role=admin, storeIds=${JSON.stringify(storeIds)}`);

  // Make sure a userProfiles doc exists under the REAL auth uid (rules + web app
  // read it by uid). If yours lives under a seed uid, this creates the correct one.
  const ref = db.collection("userProfiles").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(
      {
        uid: user.uid,
        email: user.email ?? email,
        display_name: user.displayName ?? email.split("@")[0],
        role: "admin",
        store_ids: storeIds,
        store_id: storeIds[0] ?? null,
        active: true,
        notification_email: true,
        notification_slack: false,
      },
      { merge: true }
    );
    console.log(`✓ Created userProfiles/${user.uid} (was missing)`);
  } else {
    await ref.set({ role: "admin", store_ids: storeIds }, { merge: true });
    console.log(`✓ Updated userProfiles/${user.uid} role=admin`);
  }

  console.log("\nDone. Now sign OUT and back IN on the iOS app to mint a fresh token with the claim.");
}

main().catch((e) => {
  console.error("Failed:", e?.message ?? e);
  process.exit(1);
});
