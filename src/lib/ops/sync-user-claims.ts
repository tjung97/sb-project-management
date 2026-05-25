import "server-only";

import { adminAuth } from "@/src/lib/firebase/admin";
import { profileStoreIds } from "@/src/lib/ops/user-stores";
import type { UserProfile } from "@/src/types/firestore";

export type SyncUserClaimsResult = { synced: true } | { synced: false; reason: "auth_user_not_found" };

function isAuthUserNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "auth/user-not-found"
  );
}

/** Updates Firebase Auth custom claims when an Auth user exists for this UID. */
export async function syncUserAuthClaims(
  uid: string,
  profile: Pick<UserProfile, "role" | "store_ids" | "store_id">
): Promise<SyncUserClaimsResult> {
  try {
    await adminAuth.getUser(uid);
  } catch (error) {
    if (isAuthUserNotFound(error)) {
      return { synced: false, reason: "auth_user_not_found" };
    }
    throw error;
  }

  const storeIds = profileStoreIds(profile);
  await adminAuth.setCustomUserClaims(uid, {
    role: profile.role,
    storeIds,
    storeId: storeIds[0] ?? null,
  });
  return { synced: true };
}
