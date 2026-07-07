import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebase/admin";
import { getSlingScheduleBoard } from "@/src/lib/sling/api";
import { getAllToastOpsSummaries } from "@/src/lib/toast/api";
import { PERSON_ALIASES, STORE_ALIASES } from "@/src/lib/ops/staff-aliases";
import { NOTIFY_ONLY_STORE, TEST_SCHEDULE_OVERRIDES } from "@/src/lib/ops/no-show-test";

// No-show detection (DRY RUN). Joins two systems:
//   • Sling  = who is *scheduled* today (role, start time, store)
//   • Toast  = who actually *clocked in* today
// A no-show = a published shift whose start + grace has passed, where no
// clock-in can be matched to that person. The hard/fragile part is matching a
// Sling name to a Toast name across systems, so the report surfaces the raw
// clock-in names per store for eyeballing before we ever alert.

const DEFAULT_GRACE_MIN = 30;
const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";

export type ScheduleStatus = "clocked_in" | "no_show" | "not_due" | "unverified";

export interface ScheduledPerson {
  person: string;
  role: string;
  start: string; // "9:30 AM"
  startMin: number;
  opening: boolean; // earliest published shift for the store today
  status: ScheduleStatus;
  overdueMin: number; // minutes past (start + grace); 0 if not overdue
  matchedClockIn: string | null; // the Toast name we matched them to, if any
}

export interface StoreNoShow {
  slingStore: string;
  toastStore: string | null;
  matched: boolean; // did we find a Toast store for this Sling store?
  clockedIn: string[]; // raw Toast clock-in names at this store today
  scheduled: ScheduledPerson[];
  noShowCount: number;
}

export interface NoShowReport {
  configured: boolean;
  nowIso: string;
  nowLocal: string; // "10:04 AM"
  graceMin: number;
  stores: StoreNoShow[];
  totals: { scheduled: number; clockedIn: number; noShows: number; unmatchedStores: number };
  error: string | null;
}

export async function detectNoShows(opts: { now?: Date; graceMin?: number } = {}): Promise<NoShowReport> {
  const now = opts.now ?? new Date();
  const graceMin = opts.graceMin ?? DEFAULT_GRACE_MIN;

  const empty = (error: string | null, configured = false): NoShowReport => ({
    configured,
    nowIso: now.toISOString(),
    nowLocal: localLabel(now, TZ),
    graceMin,
    stores: [],
    totals: { scheduled: 0, clockedIn: 0, noShows: 0, unmatchedStores: 0 },
    error,
  });

  try {
    const [board, summaries] = await Promise.all([getSlingScheduleBoard({ now }), getAllToastOpsSummaries(now)]);
    if (!board.configured) return empty("Sling is not configured.", false);

    const nowMin = localMinutes(now, TZ);

    // Toast clock-ins today, grouped by city key.
    const clockByCity = new Map<string, { store: string; names: string[]; norm: Set<string> }>();
    for (const store of summaries) {
      if (!store.summary.configured) continue;
      const key = cityKey(store.name);
      const entry = clockByCity.get(key) ?? { store: store.name, names: [], norm: new Set<string>() };
      for (const emp of store.summary.labor.employees) {
        if (!emp.clockIn || !emp.name) continue; // present in labor list = clocked in today
        entry.names.push(emp.name);
        entry.norm.add(normPerson(emp.name));
      }
      clockByCity.set(key, entry);
    }

    const stores: StoreNoShow[] = board.stores.map((store) => {
      const today = store.thisWeek.days.find((d) => d.isToday);
      const shifts = (today?.shifts ?? [])
        .filter((s) => s.status === "published" && s.user && s.user !== "Open shift")
        .sort((a, b) => a.startMin - b.startMin);
      const openingMin = shifts.length ? shifts[0].startMin : null;
      // Apply the store alias (e.g. Sling "Lynnwood" -> Toast "Alderwood").
      const rawCity = cityKey(store.locationName ?? store.storeName);
      const toast = clockByCity.get(STORE_ALIASES[rawCity] ?? rawCity) ?? null;

      const scheduled = shifts.map((shift) =>
        evaluate(shift.user, shift.position || "—", shift.startMin, shift.start, shift.startMin === openingMin, toast, nowMin, graceMin)
      );

      return {
        slingStore: store.storeName,
        toastStore: toast?.store ?? null,
        matched: Boolean(toast),
        clockedIn: toast ? [...new Set(toast.names)] : [],
        scheduled,
        noShowCount: scheduled.filter((s) => s.status === "no_show").length,
      };
    });

    // Inject test-harness overrides (fake shifts) into the matching store.
    for (const ov of TEST_SCHEDULE_OVERRIDES) {
      const slingCity = cityKey(ov.store);
      const toast = clockByCity.get(STORE_ALIASES[slingCity] ?? slingCity) ?? null;
      const startMin = parseHm(ov.start);
      const person = evaluate(ov.person, ov.role || "—", startMin, minLabel(startMin), false, toast, nowMin, graceMin);
      let store = stores.find((s) => cityKey(s.slingStore) === slingCity);
      if (!store) {
        store = { slingStore: ov.store, toastStore: toast?.store ?? null, matched: Boolean(toast), clockedIn: toast ? [...new Set(toast.names)] : [], scheduled: [], noShowCount: 0 };
        stores.push(store);
      }
      store.scheduled.push(person);
      store.scheduled.sort((a, b) => a.startMin - b.startMin);
      store.noShowCount = store.scheduled.filter((s) => s.status === "no_show").length;
    }

    return {
      configured: true,
      nowIso: now.toISOString(),
      nowLocal: localLabel(now, TZ),
      graceMin,
      stores,
      totals: {
        scheduled: stores.reduce((n, s) => n + s.scheduled.length, 0),
        clockedIn: stores.reduce((n, s) => n + s.clockedIn.length, 0),
        noShows: stores.reduce((n, s) => n + s.noShowCount, 0),
        unmatchedStores: stores.filter((s) => !s.matched).length,
      },
      error: null,
    };
  } catch (error) {
    return empty(error instanceof Error ? error.message : "No-show check failed.", false);
  }
}

// Evaluate one scheduled person against today's clock-ins.
function evaluate(
  person: string,
  role: string,
  startMin: number,
  startLabel: string,
  opening: boolean,
  toast: { store: string; names: string[]; norm: Set<string> } | null,
  nowMin: number,
  graceMin: number
): ScheduledPerson {
  const dueMin = startMin + graceMin;
  const matchedClockIn = toast ? matchClockIn(person, toast) : null;
  let status: ScheduleStatus;
  if (!toast) status = "unverified";
  else if (matchedClockIn) status = "clocked_in";
  else if (nowMin < dueMin) status = "not_due";
  else status = "no_show";
  return { person, role, start: startLabel, startMin, opening, status, overdueMin: Math.max(0, nowMin - dueMin), matchedClockIn };
}

// ---- Slack alerts (step 3) --------------------------------------------------

export interface NotifyResult {
  posted: number;
  skipped: number;
  error: string | null;
}

// Posts a Slack message per no-show, de-duped so each person/shift/day only
// alerts once (pass force to bypass, for testing). Scoped to NOTIFY_ONLY_STORE.
export async function notifyNoShows(report: NoShowReport, opts: { force?: boolean } = {}): Promise<NotifyResult> {
  const webhook = (process.env.SLACK_WEBHOOK_URL ?? "").trim();
  if (!webhook) return { posted: 0, skipped: 0, error: "SLACK_WEBHOOK_URL is not set." };

  const onlyCity = NOTIFY_ONLY_STORE ? cityKey(NOTIFY_ONLY_STORE) : null;
  const events = report.stores.flatMap((s) =>
    s.scheduled.filter((p) => p.status === "no_show").map((p) => ({ store: s.slingStore, ...p }))
  ).filter((e) => !onlyCity || cityKey(e.store) === onlyCity);

  const dateKey = report.nowIso.slice(0, 10);
  let posted = 0;
  let skipped = 0;

  for (const e of events) {
    const id = `${dateKey}_${cityKey(e.store)}_${normPerson(e.person).replace(/ /g, "-")}_${e.startMin}`;
    const ref = adminDb.collection("no_show_alerts").doc(id);
    if (!opts.force) {
      const doc = await ref.get();
      if (doc.exists) {
        skipped++;
        continue;
      }
    }
    const text =
      `:rotating_light: *No-show alert* — *${e.person}* (${e.role}) was scheduled *${e.start}* at *${e.store}* ` +
      `and hasn't clocked in (${e.overdueMin} min past${e.opening ? ", opening shift" : ""}).`;
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      await ref.set({ store: e.store, person: e.person, start: e.start, alerted_at: FieldValue.serverTimestamp() });
      posted++;
    } else {
      skipped++;
    }
  }

  return { posted, skipped, error: null };
}

// ---- matching ---------------------------------------------------------------

// Normalized person aliases, built once from the config.
const PERSON_ALIAS_NORM = new Map<string, string[]>(
  Object.entries(PERSON_ALIASES).map(([sling, toast]) => [normPerson(sling), toast.map(normPerson)])
);

function matchClockIn(scheduledName: string, toast: { norm: Set<string>; names: string[] }): string | null {
  const norm = normPerson(scheduledName);
  if (toast.norm.has(norm)) return scheduledName;

  // Confirmed cross-system aliases take priority.
  for (const variant of PERSON_ALIAS_NORM.get(norm) ?? []) {
    if (toast.norm.has(variant)) return `${scheduledName} (alias)`;
  }

  // Heuristic fallback: first-name match + compatible surname.
  const target = norm.split(" ").filter(Boolean);
  for (const candidate of toast.names) {
    if (likelySamePerson(target, normPerson(candidate).split(" ").filter(Boolean))) return candidate;
  }
  return null;
}

// Lenient on purpose: better to match (avoid a false "no-show!") than to miss.
// Same person if first names match AND last names are compatible (equal, same
// initial, or one side is first-name-only).
function likelySamePerson(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  if (a[0] !== b[0]) return false;
  if (a.length === 1 || b.length === 1) return true;
  const al = a[a.length - 1];
  const bl = b[b.length - 1];
  return al === bl || al[0] === bl[0];
}

function normPerson(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "Seoul Bowl Bellevue" / "Bellevue Team" / "Seoul Bowl - Tacoma Mall" -> city token.
function cityKey(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/seoul bowl/g, "")
    .replace(/\bteam\b/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ")[0] ?? "";
}

// ---- time helpers -----------------------------------------------------------

function localMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

function localLabel(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
}

function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minLabel(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}
