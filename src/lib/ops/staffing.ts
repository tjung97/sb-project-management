import "server-only";

import { DateTime } from "luxon";
import { getSlingScheduleBoard, type StoreSchedule, type SlingShiftView } from "@/src/lib/sling/api";
import { getAllForecasts, type StoreForecast } from "@/src/lib/toast/forecast";
import { getToastLocations, getAllToastOpsSummaries, getToastWeekSales } from "@/src/lib/toast/api";
import { getLaborModel, modelForStore } from "@/src/lib/ops/labor-model";
import { getLaborTargets, targetFor } from "@/src/lib/ops/labor-target";
import { computeStaffing, coverageFromShifts, type StaffingResult } from "@/src/lib/ops/staffing-math";

// Orchestrator for "staffing vs forecast": joins the Sling schedule to the Toast
// forecast per store-day and runs the pure matrix math. Supports today and the
// next 7 days (so managers can fix schedules before they're worked).

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";
const WAGE_FALLBACK = 20;
const FORECAST_OPEN_THRESHOLD = 20; // $/hr that counts as "open" when deriving hours

export interface StaffDayShift {
  startMin: number;
  endMin: number;
  user: string;
  position: string;
  status: SlingShiftView["status"];
  breakMin: number;
}

export interface StaffDay {
  date: string;
  weekday: string;
  isToday: boolean;
  isFuture: boolean;
  openMin: number;
  closeMin: number;
  posted: boolean; // any published shift that day
  hasForecast: boolean;
  result: StaffingResult;
  shifts: StaffDayShift[];
  targetPct: number;
}

export interface StoreStaffing {
  guid: string;
  name: string;
  matched: boolean;
  avgWage: number;
  targetPct: number;
  days: StaffDay[]; // [today, +1, … +7]
}

export interface StaffingForecast {
  configured: boolean;
  error: string | null;
  computedAt: string;
  horizonDays: number;
  stores: StoreStaffing[];
}

export async function getStaffingVsForecast(now = new Date()): Promise<StaffingForecast> {
  const base = DateTime.fromJSDate(now, { zone: TZ });
  const thisMon = base.startOf("week");
  const nextMon = thisMon.plus({ weeks: 1 });
  const todayYmd = base.toISODate() ?? "";
  const nowHour = base.hour + base.minute / 60;

  const [board, forecasts, locations, summaries, model, targets] = await Promise.all([
    getSlingScheduleBoard().catch((): null => null),
    getAllForecasts().catch((): Record<string, StoreForecast> => ({})),
    getToastLocations().catch(() => []),
    getAllToastOpsSummaries(now).catch(() => []),
    getLaborModel(),
    getLaborTargets(),
  ]);

  if (!board || !board.configured) {
    return { configured: false, error: board?.error ?? "Sling schedule not configured.", computedAt: new Date().toISOString(), horizonDays: 8, stores: [] };
  }

  // Store-week sales (cached) for actual hourly on past/today.
  const weekByGuid: Record<string, Awaited<ReturnType<typeof getToastWeekSales>>> = {};
  await Promise.all(
    locations.map(async (loc) => {
      weekByGuid[loc.guid] = await getToastWeekSales(loc.guid, thisMon.toISODate() ?? "").catch(() => null);
    })
  );

  const wageByGuid = new Map<string, number>();
  for (const s of summaries) {
    const { laborCost, laborHours } = s.summary.labor;
    if (laborHours > 0.5 && laborCost > 0) wageByGuid.set(s.guid, laborCost / laborHours);
  }

  const schedByToken = new Map<string, StoreSchedule>();
  for (const s of board.stores) schedByToken.set(norm(s.storeName), s);

  const stores: StoreStaffing[] = [];
  for (const loc of locations) {
    const fc = forecasts[loc.guid];
    if (!fc) continue;
    const sched = matchSchedule(loc.name, schedByToken);
    const sm = modelForStore(model, loc.guid);

    // Derive store hours from the forecast envelope unless overridden.
    const derived = deriveHours(fc);
    const openMin = sm.openMin ?? derived.openMin;
    const closeMin = sm.closeMin ?? derived.closeMin;
    const avgWage = sm.avgWage ?? wageByGuid.get(loc.guid) ?? WAGE_FALLBACK;
    const targetPct = targetFor(targets, loc.guid);

    // Index this store's shifts by date across both weeks.
    const shiftsByDate = new Map<string, SlingShiftView[]>();
    const postedByDate = new Map<string, boolean>();
    for (const wk of sched ? [sched.thisWeek, sched.nextWeek] : []) {
      for (const day of wk.days) {
        shiftsByDate.set(day.date, day.shifts);
        postedByDate.set(day.date, day.shifts.some((s) => s.status === "published"));
      }
    }

    const days: StaffDay[] = [];
    for (let i = 0; i <= 7; i++) {
      const date = base.plus({ days: i });
      const ymd = date.toISODate() ?? "";
      const wd = date.weekday - 1;
      const inThisWeek = date >= thisMon && date < nextMon;
      const fcDay = inThisWeek ? fc.thisWeek.days[wd] : fc.nextWeek.days[wd];
      const forecastHour = fcDay?.hours ?? new Array(24).fill(0);
      const hasForecast = forecastHour.some((v) => v > 0);

      const shifts = shiftsByDate.get(ymd) ?? [];
      const scheduledHour = coverageFromShifts(shifts.map((s) => ({ startMin: s.startMin, endMin: s.endMin, breaks: s.breaks })));

      // Actual hourly only for today/past (future has none).
      let actualHour: Array<number | null> | undefined;
      if (ymd <= todayYmd) {
        const h = weekByGuid[loc.guid]?.byWeekday[wd]?.hours;
        if (h) actualHour = h.map((v, hr) => (ymd < todayYmd || hr < nowHour ? v : null));
      }

      const result = computeStaffing({ forecastHour, scheduledHour, actualHour, openMin, closeMin, minCrew: sm.minCrew, matrix: sm.matrix, avgWage, grades: model.grades });

      days.push({
        date: ymd,
        weekday: date.toFormat("ccc"),
        isToday: ymd === todayYmd,
        isFuture: ymd > todayYmd,
        openMin,
        closeMin,
        posted: postedByDate.get(ymd) ?? false,
        hasForecast,
        result,
        targetPct,
        shifts: shifts.map((s) => ({
          startMin: s.startMin,
          endMin: s.endMin,
          user: s.user,
          position: s.position,
          status: s.status,
          breakMin: (s.breaks ?? []).reduce((a, b) => a + (b.endMin - b.startMin), 0),
        })),
      });
    }

    stores.push({ guid: loc.guid, name: loc.name, matched: Boolean(sched), avgWage: Math.round(avgWage * 100) / 100, targetPct, days });
  }

  // Worst fit (today) first; unmatched/no-schedule sink to the bottom.
  const todayFit = (s: StoreStaffing) => {
    const t = s.days[0];
    if (!s.matched || !t || t.result.scheduledHours + t.result.prepHours === 0) return 999;
    return t.result.fitScore;
  };
  stores.sort((a, b) => todayFit(a) - todayFit(b));

  return { configured: true, error: null, computedAt: new Date().toISOString(), horizonDays: 8, stores };
}

function deriveHours(fc: StoreForecast): { openMin: number; closeMin: number } {
  // Envelope across this-week's days: first/last hour with meaningful forecast.
  let first = 24;
  let last = 0;
  for (const day of fc.thisWeek.days) {
    for (let h = 0; h < 24; h++) {
      if ((day.hours[h] ?? 0) >= FORECAST_OPEN_THRESHOLD) {
        first = Math.min(first, h);
        last = Math.max(last, h);
      }
    }
  }
  if (first > last) return { openMin: 11 * 60, closeMin: 21 * 60 };
  return { openMin: first * 60, closeMin: (last + 1) * 60 };
}

function matchSchedule(toastName: string, byToken: Map<string, StoreSchedule>): StoreSchedule | null {
  const t = norm(toastName);
  if (byToken.has(t)) return byToken.get(t) ?? null;
  let best: { sched: StoreSchedule; len: number } | null = null;
  for (const [token, sched] of byToken) {
    if (!token || !t) continue;
    if (t.includes(token) || token.includes(t)) {
      const len = Math.min(t.length, token.length);
      if (!best || len > best.len) best = { sched, len };
    }
  }
  return best?.sched ?? null;
}

function norm(name: string): string {
  return name.toLowerCase().replace(/seoul bowl/g, "").replace(/[^a-z0-9]/g, "");
}
