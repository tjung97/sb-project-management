import "server-only";

import { adminDb } from "@/src/lib/firebase/admin";

// "Since my last visit" for the Schedule page's change marks.
// ops_user_state/{uid}: schedule_seen_at (last time the page was opened) and
// schedule_baseline (marks show changes after this). A visit more than 30 min
// after the previous one moves the baseline up to that previous visit, so a
// quick reload doesn't wipe the marks.

const REVISIT_GAP_MS = 30 * 60 * 1000;
const FIRST_VISIT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const ref = (uid: string) => adminDb.collection("ops_user_state").doc(uid);

interface SeenState {
  seenAt: number | null;
  baseline: number | null;
}

async function read(uid: string): Promise<SeenState> {
  const snap = await ref(uid).get();
  const d = snap.data() ?? {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { seenAt: num(d.schedule_seen_at), baseline: num(d.schedule_baseline) };
}

/** The baseline this visit should use (does not write). */
function baselineFor(state: SeenState, now: number): number {
  if (state.seenAt == null) return now - FIRST_VISIT_LOOKBACK_MS;
  if (now - state.seenAt > REVISIT_GAP_MS) return state.seenAt;
  return state.baseline ?? state.seenAt;
}

/** Read-only: baseline (ms) for rendering the page. */
export async function getScheduleBaseline(uid: string, now = Date.now()): Promise<number> {
  try {
    return baselineFor(await read(uid), now);
  } catch {
    return now - FIRST_VISIT_LOOKBACK_MS;
  }
}

/** Record a visit; returns the baseline in effect. */
export async function recordScheduleVisit(uid: string, now = Date.now()): Promise<number> {
  const baseline = baselineFor(await read(uid), now);
  await ref(uid).set({ schedule_seen_at: now, schedule_baseline: baseline }, { merge: true });
  return baseline;
}

/** "Mark all as seen". */
export async function markScheduleSeen(uid: string, now = Date.now()): Promise<number> {
  await ref(uid).set({ schedule_seen_at: now, schedule_baseline: now }, { merge: true });
  return now;
}
