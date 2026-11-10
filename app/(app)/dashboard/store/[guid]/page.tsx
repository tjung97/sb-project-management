import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getToastLocations, getToastWeekSales, getAllToastOpsSummaries } from "@/src/lib/toast/api";
import { getStoreForecast } from "@/src/lib/toast/forecast";
import { getStaffingVsForecast } from "@/src/lib/ops/staffing";
import { getLaborTargets, targetFor } from "@/src/lib/ops/labor-target";
import { paceToNow, projectedFinish, projectedEodLaborPct, splh, windowSum } from "@/src/lib/ops/store-metrics";
import { HourlyChart } from "@/src/components/home/SalesVisuals";
import { DayChart } from "@/src/components/home/StaffingForecast";
import { DailySalesChart, WeeklyTrendChart, VsCompany, type DailyPoint } from "@/src/components/home/StoreDetailCharts";

export const dynamic = "force-dynamic";

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const shortName = (n: string) => n.replace(/^seoul bowl\s*-?\s*/i, "").trim() || n;

export default async function StoreDetailPage({ params }: { params: Promise<{ guid: string }> }) {
  const { guid } = await params;
  const now = new Date();
  const base = DateTime.fromJSDate(now, { zone: TZ });
  const todayWd = base.weekday - 1;
  const nowHour = base.hour + base.minute / 60;
  const thisMon = base.startOf("week");

  const [locations, forecast, staffing, summaries, targets] = await Promise.all([
    getToastLocations().catch(() => []),
    getStoreForecast(guid),
    getStaffingVsForecast(now).catch(() => null),
    getAllToastOpsSummaries(now).catch(() => []),
    getLaborTargets(),
  ]);

  const name = locations.find((l) => l.guid === guid)?.name ?? forecast?.storeName ?? null;
  if (!name) notFound();

  // 3 weeks of daily sales (covers the trailing 14 days regardless of weekday).
  const weekMondays = [0, 1, 2].map((i) => thisMon.minus({ weeks: i }));
  const weekSales = await Promise.all(weekMondays.map((m) => getToastWeekSales(guid, m.toISODate() ?? "").catch(() => null)));
  const dayTotalByDate = new Map<string, number>();
  const dayHoursByDate = new Map<string, number[]>();
  weekMondays.forEach((m, wi) => {
    const wk = weekSales[wi];
    if (!wk) return;
    for (let wd = 0; wd < 7; wd++) {
      const date = m.plus({ days: wd }).toISODate() ?? "";
      dayTotalByDate.set(date, wk.byWeekday[wd]?.total ?? 0);
      dayHoursByDate.set(date, wk.byWeekday[wd]?.hours ?? new Array(24).fill(0));
    }
  });

  const summary = summaries.find((s) => s.guid === guid)?.summary ?? null;
  const target = targetFor(targets, guid);
  const staffStore = staffing?.stores.find((s) => s.guid === guid) ?? null;
  const today = staffStore?.days[0] ?? null;

  // ── Today metrics ──
  const forecastHour = forecast?.thisWeek.days[todayWd]?.hours ?? new Array(24).fill(0);
  const actualHour = dayHoursByDate.get(base.toISODate() ?? "") ?? new Array(24).fill(0);
  const pace = paceToNow(actualHour, forecastHour, nowHour);
  const forecastDay = forecastHour.reduce((a, b) => a + b, 0);
  const finish = projectedFinish(pace.actualToNow, pace.forecastToNow, forecastDay);

  const laborHours = summary?.labor.laborHours ?? 0;
  const laborCost = summary?.labor.laborCost ?? 0;
  const wage = staffStore?.avgWage ?? (laborHours > 0.5 && laborCost > 0 ? laborCost / laborHours : 20);
  const scheduledRemaining = today ? windowSum(today.result.hours.reduce((arr, h) => { arr[h.hour] = h.scheduled; return arr; }, new Array(24).fill(0)), nowHour, 24) * wage : 0;
  const projEod = projectedEodLaborPct({ laborSoFar: laborCost, scheduledLaborRemaining: scheduledRemaining, salesSoFar: pace.actualToNow, forecastRemaining: Math.max(0, forecastDay - pace.forecastToNow) });
  const splhToday = splh(pace.actualToNow, laborHours);

  // Build today's hourly window.
  let startHour = 24;
  let endHour = 0;
  for (let h = 0; h < 24; h++) if ((actualHour[h] ?? 0) > 0 || (forecastHour[h] ?? 0) > 0) { startHour = Math.min(startHour, h); endHour = Math.max(endHour, h); }
  if (startHour > endHour) { startHour = 10; endHour = 21; }

  // ── 14-day daily sales vs expected (forecast weekday baseline) ──
  const expectedByWd = forecast?.thisWeek.days.map((d) => d.total) ?? new Array(7).fill(0);
  const daily: DailyPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = base.minus({ days: i });
    const date = d.toISODate() ?? "";
    const wd = d.weekday - 1;
    daily.push({ date, label: d.toFormat("ccc d"), actual: dayTotalByDate.has(date) ? dayTotalByDate.get(date)! : d <= base ? 0 : null, expected: Math.round(expectedByWd[wd] ?? 0), isToday: i === 0 });
  }

  // ── Weekly trend from stored recentWeeks (oldest → newest) ──
  const recent = [...(forecast?.recentWeeks ?? [])].reverse(); // oldest first
  const weeks = recent.map((w, i) => {
    const prev = i > 0 ? recent[i - 1].total : null;
    const wowPct = prev && prev > 0 ? ((w.total - prev) / prev) * 100 : null;
    return { label: DateTime.fromISO(w.mondayYmd).toFormat("L/d"), total: w.total, wowPct };
  });

  // ── vs company (from summaries + staffing) ──
  const splhList = summaries.map((s) => (s.summary.labor.laborHours > 0.5 ? s.summary.sales.netSales / s.summary.labor.laborHours : null)).filter((v): v is number => v != null);
  const liveLaborList = summaries.map((s) => (s.summary.sales.netSales > 0 ? (s.summary.labor.laborCost / s.summary.sales.netSales) * 100 : null)).filter((v): v is number => v != null);
  const fitList = (staffing?.stores ?? []).map((s) => (s.days[0]?.result.scheduledHours ? s.days[0].result.fitScore : null)).filter((v): v is number => v != null);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const liveLaborPct = summary && summary.sales.netSales > 0 ? (laborCost / summary.sales.netSales) * 100 : null;

  const nextDays = staffStore?.days.slice(1) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All stores
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{shortName(name)}</h1>
        <p className="text-xs text-muted-foreground">{base.toFormat("cccc, LLLL d · h:mm a")}</p>
      </div>

      {/* Today key stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Net sales today" value={money.format(pace.actualToNow)} />
        <Stat label="vs plan" value={pace.deltaPct != null ? `${pace.deltaPct >= 0 ? "+" : ""}${Math.round(pace.deltaPct)}%` : "—"} tone={pace.deltaPct == null ? undefined : pace.deltaPct >= 0 ? "success" : "destructive"} sub={finish != null ? `on track ~${money.format(finish)}` : undefined} />
        <Stat label="Proj. EOD labor" value={projEod != null ? `${projEod.toFixed(0)}%` : "—"} tone={projEod == null ? undefined : projEod <= target ? "success" : projEod <= target + 5 ? "warning" : "destructive"} sub={`target ${target}%`} />
        <Stat label="Schedule fit" value={today && today.result.scheduledHours > 0 ? String(today.result.fitScore) : "—"} sub={today && today.result.scheduledHours > 0 ? `${today.result.misplacedHours} misplaced hrs` : undefined} />
      </div>

      {/* Today */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today · sales by hour">
          <HourlyChart data={{ startHour, endHour, actual: actualHour, projected: forecastHour, nowHour }} />
        </Panel>
        <Panel title="Today · staffing vs forecast">
          {today && today.result.scheduledHours + today.result.prepHours > 0 ? (
            <>
              <p className="mb-1 text-[11px] text-muted-foreground">{today.result.summary}</p>
              <DayChart day={today} expanded />
            </>
          ) : (
            <Empty label={staffStore?.matched ? "No shifts scheduled today." : "No Sling schedule matched."} />
          )}
        </Panel>
      </div>

      {/* 14-day + weekly */}
      <Panel title="Last 14 days · net sales vs expected">
        <DailySalesChart days={daily} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Weekly trend (last 4 weeks)">
          {weeks.length ? <WeeklyTrendChart weeks={weeks} /> : <Empty label="No weekly history yet." />}
        </Panel>
        <Panel title="This store vs company">
          <VsCompany
            rows={[
              { label: "Labor % today", store: liveLaborPct, company: avg(liveLaborList), unit: "%", betterHigh: false },
              { label: "SPLH today", store: splhToday, company: avg(splhList), unit: "$", betterHigh: true },
              { label: "Schedule fit", store: today && today.result.scheduledHours > 0 ? today.result.fitScore : null, company: avg(fitList), unit: "pts", betterHigh: true },
            ]}
          />
          <p className="mt-2 text-[10px] text-muted-foreground">Labor % today is the live ratio; projected EOD is above. Daily labor-%/SPLH history needs stored rollups (coming later).</p>
        </Panel>
      </div>

      {/* Next 7 days */}
      <Panel title="Next 7 days · forecast & schedule fit">
        {nextDays.length ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {nextDays.map((d) => {
              const empty = d.result.scheduledHours + d.result.prepHours === 0;
              const g = d.result.grade;
              const bg = empty ? "bg-muted/40 text-muted-foreground" : g === "good" ? "bg-success/15 text-success" : g === "ok" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/15 text-destructive";
              return (
                <div key={d.date} className="rounded-lg border border-border/60 p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{d.weekday}</p>
                  <p className={`mt-1 rounded px-1 py-0.5 text-sm font-semibold tabular-nums ${bg}`}>{empty ? "—" : d.result.fitScore}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">{d.result.projectedLaborPct != null && !empty ? `${Math.round(d.result.projectedLaborPct)}%` : "·"}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty label="No schedule data for the next 7 days." />
        )}
      </Panel>

      {!summary || summary.configured === false ? (
        <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-warning-foreground">
          <AlertTriangle className="h-4 w-4" /> Live Toast labor data unavailable for this store right now.
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning-foreground" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/80 bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="flex h-[140px] items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">{label}</div>;
}
