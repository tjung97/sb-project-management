import { DateTime } from "luxon";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getAllToastOpsSummaries, getToastLocations, getToastWeekSales } from "@/src/lib/toast/api";
import { getAllForecasts, WEEKDAYS, type StoreForecast } from "@/src/lib/toast/forecast";
import { getLaborTargets, targetFor } from "@/src/lib/ops/labor-target";
import { getSlingScheduleBoard, type StoreSchedule } from "@/src/lib/sling/api";
import { getLaborModel, modelForStore } from "@/src/lib/ops/labor-model";
import { computeStaffing, coverageFromShifts } from "@/src/lib/ops/staffing-math";
import { paceToNow, busyNow, projectedEodLaborPct, laborVsBudget, splh, fourWeekTrend, windowSum } from "@/src/lib/ops/store-metrics";
import { evaluateSignals, buildWins, type LaborOverReason, type Win } from "@/src/lib/ops/signals";
import { SalesDashboard, type SalesDashboardData, type StoreSalesRow } from "@/src/components/home/SalesDashboard";
import type { StoreCard } from "@/src/components/home/StorePulseGrid";

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";

const storeToken = (name: string) => name.toLowerCase().replace(/seoul bowl/g, "").replace(/[^a-z0-9]/g, "");

export async function SalesDashboardServer() {
  const now = new Date();
  const base = DateTime.fromJSDate(now, { zone: TZ });
  const thisMondayYmd = base.startOf("week").toISODate() ?? "";
  const todayWd = base.weekday - 1; // 0=Mon … 6=Sun

  const [user, locations, summaries, forecasts, targets, slingBoard, laborModel] = await Promise.all([
    getCurrentUser(),
    getToastLocations().catch(() => []),
    getAllToastOpsSummaries(now).catch(() => []),
    getAllForecasts().catch((): Record<string, StoreForecast> => ({})),
    getLaborTargets().catch(() => ({ defaultPct: 25, perStore: {} })),
    getSlingScheduleBoard().catch(() => null),
    getLaborModel(),
  ]);

  // Canonical store set = Toast locations ∪ forecast stores, so a store never
  // disappears just because getToastLocations returned a partial/cached list.
  const storeList = new Map<string, { guid: string; name: string }>();
  for (const loc of locations) storeList.set(loc.guid, { guid: loc.guid, name: loc.name });
  for (const [guid, f] of Object.entries(forecasts)) if (!storeList.has(guid)) storeList.set(guid, { guid, name: f.storeName || guid });
  const canonical = [...storeList.values()];

  const slingByToken = new Map<string, StoreSchedule>();
  for (const s of slingBoard?.stores ?? []) slingByToken.set(storeToken(s.storeName), s);
  const matchSched = (name: string): StoreSchedule | null => {
    const t = storeToken(name);
    if (slingByToken.has(t)) return slingByToken.get(t) ?? null;
    for (const [token, s] of slingByToken) if (token && t && (t.includes(token) || token.includes(t))) return s;
    return null;
  };
  const matchedSling = (name: string) => matchSched(name) != null;

  // Week-to-date sales per store (cached), fetched by guid over the union.
  const weekByGuid: Record<string, Awaited<ReturnType<typeof getToastWeekSales>>> = {};
  await Promise.all(
    canonical.map(async (loc) => {
      weekByGuid[loc.guid] = await getToastWeekSales(loc.guid, thisMondayYmd).catch(() => null);
    })
  );

  const summaryByGuid = new Map(summaries.map((s) => [s.guid, s.summary]));

  const sumDays = (vals: number[], upto: number) => vals.slice(0, upto).reduce((a, b) => a + b, 0);

  // ── Combined hourly curves (today): actual so far vs projected ──
  const combinedActualHour = new Array(24).fill(0);
  const combinedProjHour = new Array(24).fill(0);
  for (const loc of canonical) {
    const todayActual = weekByGuid[loc.guid]?.byWeekday[todayWd]?.hours;
    const todayProj = forecasts[loc.guid]?.thisWeek.days[todayWd]?.hours;
    for (let h = 0; h < 24; h++) {
      combinedActualHour[h] += todayActual?.[h] ?? 0;
      combinedProjHour[h] += todayProj?.[h] ?? 0;
    }
  }
  // Business window = hours where either curve has sales (fallback 10a–9p).
  let startHour = 24;
  let endHour = 0;
  for (let h = 0; h < 24; h++) {
    if ((combinedActualHour[h] ?? 0) > 0 || (combinedProjHour[h] ?? 0) > 0) {
      startHour = Math.min(startHour, h);
      endHour = Math.max(endHour, h);
    }
  }
  if (startHour > endHour) {
    startHour = 10;
    endHour = 21;
  }
  const nowHour = base.hour + base.minute / 60;

  // Projected sales accrued by "now" (full past hours + a slice of the current
  // one). Lets us compare today's live sales to where the forecast says we
  // should be at this exact hour — the daily pace question.
  const cumToNow = (hours: number[]): number => {
    let s = 0;
    for (let h = startHour; h <= endHour; h++) {
      if (h + 1 <= nowHour) s += hours[h] ?? 0;
      else if (h < nowHour) s += (hours[h] ?? 0) * (nowHour - h);
    }
    return s;
  };
  // Project today's finish from current pace: scale the full-day forecast by how
  // far ahead/behind we are. Too-early (tiny denominator) just shows the plan.
  const projectFinish = (actualToNow: number, projToNow: number, projDay: number): number | null => {
    if (projDay <= 0) return null;
    if (projToNow < projDay * 0.05) return Math.round(projDay);
    return Math.round(projDay * (actualToNow / projToNow));
  };

  const stores: StoreSalesRow[] = canonical.map((loc) => {
    const week = weekByGuid[loc.guid];
    const fc = forecasts[loc.guid] ?? null;
    const summary = summaryByGuid.get(loc.guid) ?? null;
    const hasToastData = week != null;

    const dayTotals = week ? week.byWeekday.map((d) => d.total) : new Array(7).fill(0);
    const todaySales = Math.round(dayTotals[todayWd] ?? 0);
    const wtdCompleted = Math.round(sumDays(dayTotals, todayWd)); // Mon..yesterday
    const wtdSales = wtdCompleted + todaySales;

    const projDays = fc?.thisWeek.days.map((d) => d.total) ?? null;
    const projCompleted = projDays ? sumDays(projDays, todayWd) : null;
    const lyDays = fc?.lastYearThisWeek.days.map((d) => d.total) ?? null;
    const lyCompleted = lyDays ? sumDays(lyDays, todayWd) : null;

    const todayLaborCost = summary?.labor.laborCost ?? 0;
    const todayLaborPct = todaySales > 0 ? (todayLaborCost / todaySales) * 100 : null;

    // Intra-day: today's sales vs plan-to-now, and where today lands.
    const projHoursToday = fc?.thisWeek.days[todayWd]?.hours ?? null;
    const projDayToday = projHoursToday ? projHoursToday.reduce((a, b) => a + b, 0) : null;
    const projToNow = projHoursToday ? cumToNow(projHoursToday) : null;
    const intradayPacePct = projToNow && projToNow > 0 ? (todaySales / projToNow) * 100 : null;
    const projFinishToday = projDayToday != null && projToNow != null ? projectFinish(todaySales, projToNow, projDayToday) : null;

    return {
      guid: loc.guid,
      name: loc.name,
      todaySales,
      wtdSales,
      projThisWeek: fc ? fc.thisWeek.total : null,
      projNextWeek: fc ? fc.nextWeek.total : null,
      pacePct: projCompleted && projCompleted > 0 ? (wtdCompleted / projCompleted) * 100 : null,
      intradayPacePct,
      projFinishToday,
      projDayToday: projDayToday != null ? Math.round(projDayToday) : null,
      dayProgressPct: projDayToday && projDayToday > 0 && projToNow != null ? (projToNow / projDayToday) * 100 : null,
      yoyPct: lyCompleted && lyCompleted > 0 ? ((wtdCompleted - lyCompleted) / lyCompleted) * 100 : null,
      lyHasData: Boolean(fc?.lastYearThisWeek.hasData),
      todayLaborPct,
      todayLaborCost: Math.round(todayLaborCost),
      laborTargetPct: targetFor(targets, loc.guid),
      notes: fc?.thisWeek.days.map((d) => d.note) ?? [],
      computedAt: fc?.computedAt ?? null,
      sparkline: (week?.byWeekday[todayWd]?.hours ?? new Array(24).fill(0)).slice(startHour, endHour + 1),
      hasToastData,
      hasSlingMatch: matchedSling(loc.name),
    };
  });

  stores.sort((a, b) => b.todaySales - a.todaySales);

  // "Needs attention today" synthesis — only once a store's day is underway
  // (≥15% of the forecast accrued) so we don't flag the volatile early morning.
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`;
  const watchlist = stores
    .map((s) => {
      const issues: string[] = [];
      const underway = (s.dayProgressPct ?? 0) >= 15;
      if (underway && s.intradayPacePct != null && s.intradayPacePct < 90) issues.push(`${signed(s.intradayPacePct - 100)} vs plan`);
      if (underway && s.todayLaborPct != null && s.todayLaborPct > s.laborTargetPct + 5)
        issues.push(`labor ${Math.round(s.todayLaborPct)}% vs ${s.laborTargetPct}%`);
      return { guid: s.guid, name: s.name, issues };
    })
    .filter((w) => w.issues.length > 0);

  // Combined, YoY/pace only over stores that have a baseline.
  const wtdWithLY = stores.filter((s) => s.yoyPct != null);
  const sum = (sel: (s: StoreSalesRow) => number | null) => stores.reduce((acc, s) => acc + (sel(s) ?? 0), 0);
  const combinedTodayLaborCost = summaries.reduce((acc, s) => acc + (s.summary.labor.laborCost ?? 0), 0);
  const combinedTodaySales = sum((s) => s.todaySales);
  const combinedProjCompleted = stores.reduce((acc, s) => {
    const fc = forecasts[s.guid];
    return acc + (fc ? fc.thisWeek.days.slice(0, todayWd).reduce((a, d) => a + d.total, 0) : 0);
  }, 0);
  const combinedWtdCompleted = stores.reduce((acc, s) => {
    const week = weekByGuid[s.guid];
    return acc + (week ? week.byWeekday.slice(0, todayWd).reduce((a, d) => a + d.total, 0) : 0);
  }, 0);
  const combinedLYCompleted = wtdWithLY.reduce((acc, s) => {
    const fc = forecasts[s.guid];
    return acc + (fc ? fc.lastYearThisWeek.days.slice(0, todayWd).reduce((a, d) => a + d.total, 0) : 0);
  }, 0);
  const combinedWtdForYoY = wtdWithLY.reduce((acc, s) => {
    const week = weekByGuid[s.guid];
    return acc + (week ? week.byWeekday.slice(0, todayWd).reduce((a, d) => a + d.total, 0) : 0);
  }, 0);

  const anyForecast = Object.keys(forecasts).length > 0;

  // Combined intra-day pace + projected finish (all stores).
  const combinedProjDayToday = combinedProjHour.reduce((a, b) => a + b, 0);
  const combinedProjToNow = cumToNow(combinedProjHour);
  const combinedIntradayPace = combinedProjToNow > 0 ? (combinedTodaySales / combinedProjToNow) * 100 : null;
  const combinedProjFinish = projectFinish(combinedTodaySales, combinedProjToNow, combinedProjDayToday);

  // ── Per-store pulse cards (reuses the pure staffing + metric modules) ──
  const todayYmd = base.toISODate() ?? "";
  let eodLaborNum = 0;
  let eodLaborDen = 0;

  const cards: StoreCard[] = canonical.map((loc) => {
    const row = stores.find((s) => s.guid === loc.guid)!;
    const fc = forecasts[loc.guid] ?? null;
    const week = weekByGuid[loc.guid];
    const summary = summaryByGuid.get(loc.guid) ?? null;
    const forecastHour: number[] = fc?.thisWeek.days[todayWd]?.hours ?? new Array(24).fill(0);
    const actualHour: number[] = week?.byWeekday[todayWd]?.hours ?? new Array(24).fill(0);

    const sched = matchSched(loc.name);
    const todayShifts = sched?.thisWeek.days.find((d) => d.date === todayYmd || d.isToday)?.shifts ?? [];
    const scheduledHour = coverageFromShifts(todayShifts.map((s) => ({ startMin: s.startMin, endMin: s.endMin, breaks: s.breaks })));

    const sm = modelForStore(laborModel, loc.guid);
    const envelope = deriveOpenClose(fc?.thisWeek.days.map((d) => d.hours) ?? []);
    const openMin = sm.openMin ?? envelope.openMin;
    const closeMin = sm.closeMin ?? envelope.closeMin;
    const laborHoursSoFar = summary?.labor.laborHours ?? 0;
    const laborSoFar = summary?.labor.laborCost ?? 0;
    const wage = sm.avgWage ?? (laborHoursSoFar > 0.5 && laborSoFar > 0 ? laborSoFar / laborHoursSoFar : 20);

    const staff = computeStaffing({ forecastHour, scheduledHour, actualHour, openMin, closeMin, minCrew: sm.minCrew, matrix: sm.matrix, avgWage: wage, grades: laborModel.grades });
    const pace = paceToNow(actualHour, forecastHour, nowHour);
    const busy = busyNow(actualHour, forecastHour, nowHour, 1);
    const forecastDay = forecastHour.reduce((a, b) => a + b, 0);
    const forecastRemaining = Math.max(0, forecastDay - pace.forecastToNow);
    const scheduledLaborRemaining = windowSum(scheduledHour, nowHour, 24) * wage;
    const projEod = projectedEodLaborPct({ laborSoFar, scheduledLaborRemaining, salesSoFar: pace.actualToNow, forecastRemaining });
    const budget = laborVsBudget(staff.projectedLaborCost, forecastDay, row.laborTargetPct);
    const trend = fourWeekTrend((fc?.recentWeeks ?? []).map((w) => w.total));

    if (projEod != null) {
      eodLaborNum += laborSoFar + scheduledLaborRemaining;
      eodLaborDen += pace.actualToNow + forecastRemaining;
    }

    // Signals (rule-based, thresholds in signals.ts).
    const fromH = Math.floor(nowHour);
    let understaffNext2h = 0;
    for (const h of staff.hours) if (h.open && h.hour >= fromH && h.hour <= fromH + 1) understaffNext2h = Math.max(understaffNext2h, h.required - h.scheduled);
    const laborOverReason: LaborOverReason = staff.prepHours >= 2 ? "prep hours" : staff.netHours > 0 ? "extra hours" : "slow sales";
    const openHoursElapsed = Math.max(0, nowHour - openMin / 60);

    const sig = evaluateSignals({
      hasToastData: row.hasToastData,
      hasSlingMatch: row.hasSlingMatch,
      openHoursElapsed,
      paceDelta: pace.deltaPct,
      busyIndexPct: busy.indexPct,
      projEodLaborPct: projEod,
      laborTargetPct: row.laborTargetPct,
      understaffNext2h,
      laborOverReason,
    });
    const status: StoreCard["status"] = sig.status === "neutral" ? "ok" : sig.status;
    const why = sig.why;

    return {
      guid: loc.guid,
      name: loc.name,
      status,
      why,
      netToday: row.todaySales,
      pacePct: pace.pacePct,
      paceDelta: pace.deltaPct,
      projFinish: row.projFinishToday,
      busyIndex: busy.indexPct,
      projEodLaborPct: projEod != null ? Math.round(projEod * 10) / 10 : null,
      liveLaborPct: row.todayLaborPct,
      laborTargetPct: row.laborTargetPct,
      laborDeltaDollars: projEod != null ? budget.deltaDollars : null,
      splhToday: splh(pace.actualToNow, laborHoursSoFar),
      fitScore: staff.scheduledHours > 0 ? staff.fitScore : null,
      misplacedHours: staff.scheduledHours > 0 ? staff.misplacedHours : null,
      sparkActual: actualHour.slice(startHour, endHour + 1),
      sparkForecast: forecastHour.slice(startHour, endHour + 1),
      nowIndex: Math.max(0, Math.min(endHour - startHour, Math.floor(nowHour) - startHour)),
      trendWeeks: trend.weeks,
      trendWowPct: trend.wowPct,
      hasToastData: row.hasToastData,
    };
  });

  const attentionRank = { attention: 0, nodata: 1, ok: 2, good: 3 } as const;
  cards.sort((a, b) => attentionRank[a.status] - attentionRank[b.status] || b.netToday - a.netToday);
  const companyProjEodLabor = eodLaborDen > 0 ? (eodLaborNum / eodLaborDen) * 100 : null;
  const needAttention = cards.filter((c) => c.status === "attention").length;
  const needsAttention = cards.filter((c) => c.status === "attention").map((c) => ({ guid: c.guid, name: shortNameFor(c.name), why: c.why }));
  const wins: Win[] = buildWins(cards.map((c) => ({ guid: c.guid, name: shortNameFor(c.name), projEodLaborPct: c.projEodLaborPct, laborTargetPct: c.laborTargetPct, paceDelta: c.paceDelta, hasToastData: c.hasToastData })));

  // ── Weekly projected vs actual vs last-year (combined) ──
  const weekDays = WEEKDAYS.map((weekday, d) => {
    let projected = 0;
    let lastYear = 0;
    let actual = 0;
    for (const loc of canonical) {
      const fc = forecasts[loc.guid];
      projected += fc?.thisWeek.days[d]?.total ?? 0;
      lastYear += fc?.lastYearThisWeek.days[d]?.total ?? 0;
      actual += weekByGuid[loc.guid]?.byWeekday[d]?.total ?? 0;
    }
    return { weekday, projected, lastYear, actual: d <= todayWd ? Math.round(actual) : null };
  });

  const dataHealth = {
    updatedLabel: base.toFormat("h:mm a"),
    noDataStores: stores.filter((s) => !s.hasToastData).map((s) => shortNameFor(s.name)),
    noSlingStores: stores.filter((s) => !s.hasSlingMatch).map((s) => shortNameFor(s.name)),
  };
  const anyLastYear = stores.some((s) => s.lyHasData);

  const data: SalesDashboardData = {
    greeting: greeting(base.hour),
    userName: firstName(user?.name ?? user?.email ?? ""),
    dateLabel: base.toFormat("cccc, LLLL d"),
    configured: canonical.length > 0,
    anyForecast,
    anyLastYear,
    dataHealth,
    combined: {
      todaySales: combinedTodaySales,
      wtdSales: sum((s) => s.wtdSales),
      projThisWeek: anyForecast ? sum((s) => s.projThisWeek) : null,
      projNextWeek: anyForecast ? sum((s) => s.projNextWeek) : null,
      laborPct: combinedTodaySales > 0 ? (combinedTodayLaborCost / combinedTodaySales) * 100 : null,
      laborTargetPct: targets.defaultPct,
      yoyPct: combinedLYCompleted > 0 ? ((combinedWtdForYoY - combinedLYCompleted) / combinedLYCompleted) * 100 : null,
      pacePct: combinedProjCompleted > 0 ? (combinedWtdCompleted / combinedProjCompleted) * 100 : null,
      intradayPacePct: combinedIntradayPace,
      projFinishToday: combinedProjFinish,
      projDayToday: anyForecast ? Math.round(combinedProjDayToday) : null,
    },
    hourly: { startHour, endHour, actual: combinedActualHour, projected: combinedProjHour, nowHour },
    week: { days: weekDays, todayIndex: todayWd },
    watchlist,
    cards,
    needsAttention,
    wins,
    company: {
      netToday: combinedTodaySales,
      paceDelta: combinedIntradayPace != null ? combinedIntradayPace - 100 : null,
      projFinish: combinedProjFinish,
      projEodLaborPct: companyProjEodLabor,
      laborTargetPct: targets.defaultPct,
      needAttention,
    },
    stores,
  };

  return <SalesDashboard data={data} />;
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(value: string): string {
  const name = value.includes("@") ? value.split("@")[0] : value;
  return name.split(/[ .]/)[0].replace(/^\w/, (c) => c.toUpperCase());
}

function shortNameFor(name: string): string {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}

function deriveOpenClose(days: number[][]): { openMin: number; closeMin: number } {
  let first = 24;
  let last = 0;
  for (const hours of days) for (let h = 0; h < 24; h++) if ((hours[h] ?? 0) >= 20) {
    first = Math.min(first, h);
    last = Math.max(last, h);
  }
  if (first > last) return { openMin: 11 * 60, closeMin: 21 * 60 };
  return { openMin: first * 60, closeMin: (last + 1) * 60 };
}
