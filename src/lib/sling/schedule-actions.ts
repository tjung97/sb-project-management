"use server";

import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getScheduleChanges, getShiftHistory } from "@/src/lib/sling/activity";
import { markScheduleSeen, recordScheduleVisit } from "@/src/lib/sling/schedule-seen";
import type { ScheduleChange, ScheduleChangesResult } from "@/src/lib/sling/schedule-change-format";

async function signedIn() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");
  return user;
}

/** Full Sling history for one shift (oldest first). Read-only. */
export async function loadShiftHistory(shiftId: string): Promise<{ entries: ScheduleChange[]; error: string | null }> {
  await signedIn();
  return getShiftHistory(String(shiftId));
}

/** One older page of the change feed. Read-only. */
export async function loadOlderChanges(before: string): Promise<ScheduleChangesResult> {
  await signedIn();
  if (!/^\d{1,20}$/.test(before)) return { changes: [], nextBefore: null, error: "Invalid cursor." };
  return getScheduleChanges({ since: new Date(0), before });
}

/** Called once when the Schedule page opens. Returns the baseline (ms). */
export async function recordScheduleVisitAction(): Promise<number> {
  const user = await signedIn();
  return recordScheduleVisit(user.uid);
}

/** "Mark all as seen". Returns the new baseline (ms). */
export async function markScheduleSeenAction(): Promise<number> {
  const user = await signedIn();
  return markScheduleSeen(user.uid);
}
