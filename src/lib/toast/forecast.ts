import "server-only";

import { DateTime } from "luxon";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebase/admin";
import { getToastWeekSales, type ToastDaySales, type ToastWeekSales } from "@/src/lib/toast/api";

// Sales forecast engine — a faithful TS port of sales_prediction.py:
//   4-week weighted avg = W1×40% + W2×30% + W3×20% + W4×10%  (W1 = most recent)
//   Prediction          = last_year×60% + 4-week_avg×40%
// A day under $50 total counts as "closed / no data" and is excluded, with the
// weights redistributed among the open weeks. The per-day `note` records exactly
// which rule fired ("Standard", "LY closed → 100% recent avg", etc.) so the
// dashboard can show how each number was derived.

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";
const CLOSED_DAY_THRESHOLD = 50;
const RECENT_WEIGHTS = [0.4, 0.3, 0.2, 0.1]; // W1..W4, most-recent-first
const LY_WEIGHT = 0.6;
const RECENT_BLEND_WEIGHT = 0.4;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface DayProjection {
  weekday: string;
  total: number;
  hours: number[]; // index 0..23
  note: string;
}

export interface ForecastWeek {
  mondayYmd: string;
  days: DayProjection[];
  total: number;
}

export interface StoreForecast {
  storeGuid: string;
  storeName: string;
  computedAt: string;
  weekSignature: string; // ISO week of "this Monday" — recompute when it changes
  thisWeek: ForecastWeek;
  nextWeek: ForecastWeek;
  /** Same calendar week one year ago — the YoY baseline. */
  lastYearThisWeek: { days: Array<{ weekday: string; total: number }>; total: number; hasData: boolean };
  recentWeeks: Array<{ mondayYmd: string; total: number; orderCount: number }>;
  error: string | null;
}

const COLLECTION = "sales_forecast";

export async function getStoreForecast(guid: string): Promise<StoreForecast | null> {
  try {
    const snap = await adminDb.collection(COLLECTION).doc(guid).get();
    return snap.exists ? (snap.data() as StoreForecast) : null;
  } catch {
    return null;
  }
}

export async function getAllForecasts(): Promise<Record<string, StoreForecast>> {
  try {
    const snap = await adminDb.collection(COLLECTION).get();
    const out: Record<string, StoreForecast> = {};
    for (const doc of snap.docs) out[doc.id] = doc.data() as StoreForecast;
    return out;
  } catch {
    return {};
  }
}

function mondayOf(dt: DateTime): DateTime {
  return dt.startOf("week"); // luxon weeks start Monday
}

/** Fetch the weeks, compute both-week projections + YoY, and persist to Firestore. */
export async function computeAndSaveStoreForecast(
  guid: string,
  storeName: string,
  now = new Date()
): Promise<StoreForecast> {
  const base = DateTime.fromJSDate(now, { zone: TZ });
  const thisMon = mondayOf(base);
  const nextMon = thisMon.plus({ weeks: 1 });
  const weekSignature = `${thisMon.weekYear}-W${thisMon.weekNumber}`;

  // Weeks to fetch: 4 recent completed weeks + LY-this-week + LY-next-week.
  const recentMondays = [1, 2, 3, 4].map((i) => thisMon.minus({ weeks: i }));
  const lyThisMon = thisMon.minus({ weeks: 52 });
  const lyNextMon = nextMon.minus({ weeks: 52 });

  const fetchWeek = (m: DateTime) => getToastWeekSales(guid, m.toISODate() ?? "");

  try {
    // Sequential to stay under Toast rate limits (each week is a heavy paged fetch).
    const recent: Array<ToastWeekSales | null> = [];
    for (const m of recentMondays) recent.push(await fetchWeek(m));
    const lyThis = await fetchWeek(lyThisMon);
    const lyNext = await fetchWeek(lyNextMon);

    const thisWeek = buildWeek(thisMon.toISODate() ?? "", lyThis, recent);
    const nextWeek = buildWeek(nextMon.toISODate() ?? "", lyNext, recent);

    const lyDays = WEEKDAYS.map((wd, d) => ({ weekday: wd, total: Math.round(lyThis?.byWeekday[d]?.total ?? 0) }));
    const forecast: StoreForecast = {
      storeGuid: guid,
      storeName,
      computedAt: new Date().toISOString(),
      weekSignature,
      thisWeek,
      nextWeek,
      lastYearThisWeek: {
        days: lyDays,
        total: Math.round(lyThis?.total ?? 0),
        hasData: (lyThis?.total ?? 0) >= CLOSED_DAY_THRESHOLD,
      },
      recentWeeks: recentMondays.map((m, i) => ({
        mondayYmd: m.toISODate() ?? "",
        total: Math.round(recent[i]?.total ?? 0),
        orderCount: recent[i]?.orderCount ?? 0,
      })),
      error: null,
    };

    await adminDb.collection(COLLECTION).doc(guid).set({ ...forecast, saved_at: FieldValue.serverTimestamp() });
    return forecast;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forecast computation failed.";
    // Keep any prior doc; just record the error on a lightweight write.
    await adminDb.collection(COLLECTION).doc(guid).set({ error: message, computedAt: new Date().toISOString() }, { merge: true });
    throw error;
  }
}

function buildWeek(mondayYmd: string, ly: ToastWeekSales | null, recent: Array<ToastWeekSales | null>): ForecastWeek {
  const days = WEEKDAYS.map((weekday, d) => {
    const lyDay = ly?.byWeekday[d] ?? emptyDay();
    const recentDays = recent.map((w) => w?.byWeekday[d] ?? emptyDay());
    return { weekday, ...blendDay(lyDay, recentDays) };
  });
  return { mondayYmd, days, total: Math.round(days.reduce((sum, day) => sum + day.total, 0)) };
}

// The core blend for one weekday, mirroring sales_prediction.py's fallbacks.
function blendDay(lyDay: ToastDaySales, recentDays: ToastDaySales[]): { total: number; hours: number[]; note: string } {
  const lyClosed = lyDay.total < CLOSED_DAY_THRESHOLD;

  const valid = recentDays
    .map((day, i) => ({ day, weight: RECENT_WEIGHTS[i] }))
    .filter((r) => r.day.total >= CLOSED_DAY_THRESHOLD);
  const nClosedRecent = recentDays.length - valid.length;

  const fourWk = (() => {
    if (!valid.length) return new Array(24).fill(0);
    const totalW = valid.reduce((s, r) => s + r.weight, 0);
    return Array.from({ length: 24 }, (_, h) => valid.reduce((s, r) => s + r.day.hours[h] * (r.weight / totalW), 0));
  })();

  let hours: number[];
  let note: string;
  if (!lyClosed && valid.length) {
    hours = Array.from({ length: 24 }, (_, h) => lyDay.hours[h] * LY_WEIGHT + fourWk[h] * RECENT_BLEND_WEIGHT);
    note = nClosedRecent === 0 ? "Standard blend (LY 60% + recent 40%)" : `Standard; ${nClosedRecent} recent week(s) excluded (closed)`;
  } else if (!lyClosed && !valid.length) {
    hours = lyDay.hours.slice();
    note = "All recent weeks closed → 100% last year";
  } else if (lyClosed && valid.length) {
    hours = fourWk;
    note = "Last year closed/no data → 100% recent average";
  } else {
    hours = new Array(24).fill(0);
    note = "No data (closed last year and recently)";
  }

  return { total: Math.round(hours.reduce((s, v) => s + v, 0)), hours: hours.map((v) => Math.round(v)), note };
}

function emptyDay(): ToastDaySales {
  return { hours: new Array(24).fill(0), total: 0 };
}
