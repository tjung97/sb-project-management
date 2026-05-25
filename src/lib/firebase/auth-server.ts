import { cookies } from "next/headers";
import { adminAuth, adminDb } from "./admin";
import { profileStoreIds, storeIdsFromTokenClaims } from "@/src/lib/ops/user-stores";
import type { UserProfile } from "@/src/types/firestore";

export type UserRole = "admin" | "manager" | "member";

export interface AuthUser {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  storeIds: string[];
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(token);
    const tokenRole = (decoded["role"] as UserRole | undefined) ?? "member";
    const tokenStoreIds = storeIdsFromTokenClaims(decoded as Record<string, unknown>);

    const profileSnap = await adminDb.collection("userProfiles").doc(decoded.uid).get();
    if (profileSnap.exists) {
      const profile = profileSnap.data() as UserProfile;
      return {
        uid: decoded.uid,
        email: profile.email ?? decoded.email ?? null,
        name: profile.display_name ?? decoded.name ?? null,
        role: profile.role ?? tokenRole,
        storeIds: profileStoreIds(profile),
      };
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      role: tokenRole,
      storeIds: tokenStoreIds,
    };
  } catch {
    return null;
  }
}

export function requireAdmin(user: AuthUser) {
  if (user.role !== "admin") {
    throw new Error("Admin access required.");
  }
}
