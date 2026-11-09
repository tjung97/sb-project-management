import { DateTime } from "luxon";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getAllToastOpsSummaries, getToastLocations, getToastWeekSales } from "@/src/lib/toast/api";
import { getAllForecasts, WEEKDAYS, type StoreForecast } from "@/src/lib/toast/forecast";
import { getLaborTargets, targetFor } from "@/src/lib/ops/labor-target";
import { SalesDashboard, type SalesDashboardData, type StoreSalesRow } from "@/src/components/home/SalesDashboard";

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";

export async function SalesDashboardServer() {
  const now = new Date();
  const base = DateTime.fromJSDate(now, { zone: TZ });
  const thisMondayYmd = base.startOf("week").toISODate() ?? "";
  const todayWd = base.weekday - 1; // 0=Mon … 6=Sun

  const [user, locations, summaries, forecasts, targets] = await Promise.all([
    getCurrentUser(),
    getToastLocations().catch(() => []),
    getAllToastOpsSummaries(now).catch(() => []),
    getAllForecasts().catch((): Record<string, StoreForecast> => ({})),
    getLaborTargets().catch(() => ({ defaultPct: 25, perStore: {} })),
  ]);

  // Week-to-date sales per store (cached), fetched in parallel.
  const weekByGuid: Record<string, Awaited<ReturnType<typeof getToastWeekSales>>> = {};
  await Promise.all(
    locations.map(async (loc) => {
      weekByGuid[loc.guid] = await getToastWeekSales(loc.guid, thisMondayYmd).catch(() => null);
    })
  );

  const summaryByGuid = new Map(summaries.map((s) => [s.guid, s.summary]));

  const sumDays = (vals: number[], upto: number) => vals.slice(0, upto).reduce((a, b) => a + b, 0);

  // ── Combined hourly curves (today): actual so far vs projected ──
  const combinedActualHour = new Array(24).fill(0);
  const combinedProjHour = new Array(24).fill(0);
  for (const loc of locations) {
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

  const stores: StoreSalesRow[] = locations.map((loc) => {
    const week = weekByGuid[loc.guid];
    const fc = forecasts[loc.guid] ?? null;
    const summary = summaryByGuid.get(loc.guid) ?? null;

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

    return {
      guid: loc.guid,
      name: loc.name,
      todaySales,
      wtdSales,
      projThisWeek: fc ? fc.thisWeek.total : null,
      projNextWeek: fc ? fc.nextWeek.total : null,
      pacePct: projCompleted && projCompleted > 0 ? (wtdCompleted / projCompleted) * 100 : null,
      yoyPct: lyCompleted && lyCompleted > 0 ? ((wtdCompleted - lyCompleted) / lyCompleted) * 100 : null,
      lyHasData: Boolean(fc?.lastYearThisWeek.hasData),
      todayLaborPct,
      laborTargetPct: targetFor(targets, loc.guid),
      notes: fc?.thisWeek.days.map((d) => d.note) ?? [],
      computedAt: fc?.computedAt ?? null,
      sparkline: (week?.byWeekday[todayWd]?.hours ?? new Array(24).fill(0)).slice(startHour, endHour + 1),
    };
  });

  stores.sort((a, b) => b.todaySales - a.todaySales);

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

  // ── Weekly projected vs actual vs last-year (combined) ──
  const weekDays = WEEKDAYS.map((weekday, d) => {
    let projected = 0;
    let lastYear = 0;
    let actual = 0;
    for (const loc of locations) {
      const fc = forecasts[loc.guid];
      projected += fc?.thisWeek.days[d]?.total ?? 0;
      lastYear += fc?.lastYearThisWeek.days[d]?.total ?? 0;
      actual += weekByGuid[loc.guid]?.byWeekday[d]?.total ?? 0;
    }
    return { weekday, projected, lastYear, actual: d <= todayWd ? Math.round(actual) : null };
  });

  const data: SalesDashboardData = {
    greeting: greeting(base.hour),
    userName: firstName(user?.name ?? user?.email ?? ""),
    dateLabel: base.toFormat("cccc, LLLL d"),
    configured: locations.length > 0,
    anyForecast,
    combined: {
      todaySales: combinedTodaySales,
      wtdSales: sum((s) => s.wtdSales),
      projThisWeek: anyForecast ? sum((s) => s.projThisWeek) : null,
      projNextWeek: anyForecast ? sum((s) => s.projNextWeek) : null,
      laborPct: combinedTodaySales > 0 ? (combinedTodayLaborCost / combinedTodaySales) * 100 : null,
      laborTargetPct: targets.defaultPct,
      yoyPct: combinedLYCompleted > 0 ? ((combinedWtdForYoY - combinedLYCompleted) / combinedLYCompleted) * 100 : null,
      pacePct: combinedProjCompleted > 0 ? (combinedWtdCompleted / combinedProjCompleted) * 100 : null,
    },
    hourly: { startHour, endHour, actual: combinedActualHour, projected: combinedProjHour, nowHour },
    week: { days: weekDays, todayIndex: todayWd },
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
