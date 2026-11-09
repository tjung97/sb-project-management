import "server-only";

import { DateTime } from "luxon";
import { getSlingScheduleBoard, type StoreSchedule, type SlingShiftView } from "@/src/lib/sling/api";
import { getAllForecasts, type StoreForecast } from "@/src/lib/toast/forecast";
import { getToastLocations } from "@/src/lib/toast/api";

// Phase 2 — "is the schedule built for the forecast?"
//
// Wage-free, honest method: compare the SHAPE of scheduled labor to the SHAPE of
// projected demand for today. We hold the labor you've scheduled constant and ask
// whether it's distributed to match when sales actually come in. Per hour:
//   expected[h] = totalStaffHours × demandShare[h]
//   gap[h]      = staff[h] − expected[h]      (negative during a rush = understaffed)
// This answers alignment without needing wages, which Sling doesn't give us.

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";

export type HourStatus = "under" | "over" | "ok";

export interface StaffHour {
  hour: number;
  demand: number; // projected $ this hour
  staff: number; // scheduled headcount present (fractional person-hours/hour)
  status: HourStatus;
}

export interface StoreStaffing {
  guid: string;
  name: string;
  matched: boolean; // found a Sling schedule for this store
  posted: boolean; // today's shifts are published (vs draft / none)
  startHour: number;
  endHour: number;
  hours: StaffHour[];
  totalStaffHours: number;
  peakStaff: number;
  verdict: string;
}

export interface StaffingForecast {
  configured: boolean;
  error: string | null;
  computedAt: string;
  stores: StoreStaffing[];
}

export async function getStaffingVsForecast(now = new Date()): Promise<StaffingForecast> {
  const base = DateTime.fromJSDate(now, { zone: TZ });
  const todayWd = base.weekday - 1; // 0=Mon
  const todayYmd = base.toISODate() ?? "";

  const [board, forecasts, locations] = await Promise.all([
    getSlingScheduleBoard().catch((): null => null),
    getAllForecasts().catch((): Record<string, StoreForecast> => ({})),
    getToastLocations().catch(() => []),
  ]);

  if (!board || !board.configured) {
    return { configured: false, error: board?.error ?? "Sling schedule not configured.", computedAt: new Date().toISOString(), stores: [] };
  }

  // Index Sling schedules by a normalized store token.
  const schedByToken = new Map<string, StoreSchedule>();
  for (const s of board.stores) schedByToken.set(norm(s.storeName), s);

  const stores: StoreStaffing[] = [];
  for (const loc of locations) {
    const fc = forecasts[loc.guid];
    if (!fc) continue; // no forecast → nothing to compare against
    const demand = fc.thisWeek.days[todayWd]?.hours ?? new Array(24).fill(0);

    const sched = matchSchedule(loc.name, schedByToken);
    const today = sched?.thisWeek.days.find((d) => d.date === todayYmd || d.isToday);
    const shifts = today?.shifts ?? [];
    const posted = shifts.some((s) => s.status === "published");
    const staff = staffPerHour(shifts);

    // Business window = union of hours with demand or staff (fallback 10–21).
    let startHour = 24;
    let endHour = 0;
    for (let h = 0; h < 24; h++) {
      if ((demand[h] ?? 0) > 0 || staff[h] > 0.05) {
        startHour = Math.min(startHour, h);
        endHour = Math.max(endHour, h);
      }
    }
    if (startHour > endHour) {
      startHour = 10;
      endHour = 21;
    }

    const windowHours: number[] = [];
    for (let h = startHour; h <= endHour; h++) windowHours.push(h);

    const totalStaffHours = windowHours.reduce((a, h) => a + staff[h], 0);
    const totalDemand = windowHours.reduce((a, h) => a + (demand[h] ?? 0), 0);
    const avgDemand = windowHours.length ? totalDemand / windowHours.length : 0;

    const hours: StaffHour[] = windowHours.map((h) => {
      const d = demand[h] ?? 0;
      const expected = totalDemand > 0 ? totalStaffHours * (d / totalDemand) : 0;
      const gap = staff[h] - expected;
      let status: HourStatus = "ok";
      // Only flag hours that matter (meaningful demand) and that miss by ≥ ~half a person.
      if (d >= avgDemand * 0.5 && totalStaffHours > 0) {
        if (gap <= -0.5) status = "under";
        else if (gap >= 0.6) status = "over";
      }
      return { hour: h, demand: Math.round(d), staff: Math.round(staff[h] * 10) / 10, status };
    });

    stores.push({
      guid: loc.guid,
      name: loc.name,
      matched: Boolean(sched),
      posted,
      startHour,
      endHour,
      hours,
      totalStaffHours: Math.round(totalStaffHours * 10) / 10,
      peakStaff: Math.round(Math.max(0, ...windowHours.map((h) => staff[h])) * 10) / 10,
      verdict: verdictFor(hours, sched ? (shifts.length ? posted : false) : null, totalStaffHours),
    });
  }

  // Attention first: understaffed, then overstaffed, then aligned.
  const score = (s: StoreStaffing) =>
    s.hours.some((h) => h.status === "under") ? 0 : s.hours.some((h) => h.status === "over") ? 1 : s.totalStaffHours === 0 ? 2 : 3;
  stores.sort((a, b) => score(a) - score(b));

  return { configured: true, error: null, computedAt: new Date().toISOString(), stores };
}

function staffPerHour(shifts: SlingShiftView[]): number[] {
  const arr = new Array(24).fill(0);
  for (const s of shifts) {
    for (let h = 0; h < 24; h++) {
      const hs = h * 60;
      const he = hs + 60;
      const overlap = Math.max(0, Math.min(he, s.endMin) - Math.max(hs, s.startMin));
      arr[h] += overlap / 60;
    }
  }
  return arr;
}

function matchSchedule(toastName: string, byToken: Map<string, StoreSchedule>): StoreSchedule | null {
  const t = norm(toastName);
  if (byToken.has(t)) return byToken.get(t) ?? null;
  // Fall back to containment either direction (e.g. "bellevue" ⊂ "seoulbowlbellevue").
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

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? "a" : "p";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${ampm}`;
}

function verdictFor(hours: StaffHour[], posted: boolean | null, totalStaffHours: number): string {
  if (posted === null) return "No Sling schedule matched";
  if (totalStaffHours === 0) return posted ? "No shifts today" : "Schedule not posted for today";
  const under = groupRanges(hours.filter((h) => h.status === "under").map((h) => h.hour));
  const over = groupRanges(hours.filter((h) => h.status === "over").map((h) => h.hour));
  const parts: string[] = [];
  if (under.length) parts.push(`Understaffed ${under.join(", ")}`);
  if (over.length) parts.push(`Overstaffed ${over.join(", ")}`);
  const base = parts.length ? parts.join(" · ") : "Well aligned with forecast";
  return posted ? base : `${base} (draft — not posted)`;
}

function groupRanges(hoursAsc: number[]): string[] {
  if (!hoursAsc.length) return [];
  const sorted = [...hoursAsc].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const h = sorted[i];
    if (h === prev + 1) {
      prev = h;
      continue;
    }
    ranges.push(start === prev ? `${hourLabel(start)}–${hourLabel(start + 1)}` : `${hourLabel(start)}–${hourLabel(prev + 1)}`);
    start = h;
    prev = h;
  }
  return ranges;
}
