import type { AuthUser } from "@/src/lib/firebase/auth-server";
import type { UserProfile } from "@/src/types/firestore";

/** Resolved store/location IDs for a profile (migrates legacy `store_id`). */
export function profileStoreIds(profile: Pick<UserProfile, "store_ids" | "store_id">): string[] {
  const fromArray = profile.store_ids?.filter(Boolean) ?? [];
  if (fromArray.length > 0) return [...new Set(fromArray)];
  if (profile.store_id) return [profile.store_id];
  return [];
}

export function userCanAccessLocation(user: Pick<AuthUser, "role" | "storeIds">, locationId: string | null | undefined) {
  if (!locationId) return false;
  if (user.role === "admin") return true;
  return user.storeIds.includes(locationId);
}

export function storeIdsFromTokenClaims(claims: Record<string, unknown>): string[] {
  const fromArray = claims.storeIds;
  if (Array.isArray(fromArray)) {
    return [...new Set(fromArray.map(String).filter(Boolean))];
  }
  const legacy = claims.storeId;
  if (typeof legacy === "string" && legacy.length > 0) return [legacy];
  return [];
}
