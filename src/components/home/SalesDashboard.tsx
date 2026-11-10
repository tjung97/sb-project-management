import { TrendingUp, TrendingDown, Minus, Info, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { HourlyChart, WeekChart, Sparkline, type HourlyData, type WeekDayBar } from "@/src/components/home/SalesVisuals";
import { StorePulseGrid, type StoreCard } from "@/src/components/home/StorePulseGrid";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export interface StoreSalesRow {
  guid: string;
  name: string;
  todaySales: number;
  wtdSales: number;
  projThisWeek: number | null;
  projNextWeek: number | null;
  pacePct: number | null; // week-to-date vs projected-to-date (completed days)
  intradayPacePct: number | null; // today's sales vs forecast-to-this-hour
  projFinishToday: number | null; // where today lands at current pace
  projDayToday: number | null; // today's full-day forecast
  yoyPct: number | null; // completed days vs last year same days
  lyHasData: boolean;
  dayProgressPct: number | null; // how much of today's forecast has accrued by now
  todayLaborPct: number | null;
  todayLaborCost: number;
  laborTargetPct: number;
  notes: string[];
  computedAt: string | null;
  sparkline: number[]; // today's actual sales by hour (business range)
  hasToastData: boolean;
  hasSlingMatch: boolean;
}

export interface SalesDashboardData {
  greeting: string;
  userName: string;
  dateLabel: string;
  configured: boolean;
  anyForecast: boolean;
  anyLastYear: boolean;
  dataHealth: { updatedLabel: string; noDataStores: string[]; noSlingStores: string[] };
  combined: {
    todaySales: number;
    wtdSales: number;
    projThisWeek: number | null;
    projNextWeek: number | null;
    laborPct: number | null;
    laborTargetPct: number;
    yoyPct: number | null;
    pacePct: number | null;
    intradayPacePct: number | null;
    projFinishToday: number | null;
    projDayToday: number | null;
  };
  hourly: HourlyData | null;
  week: { days: WeekDayBar[]; todayIndex: number } | null;
  watchlist: Array<{ guid: string; name: string; issues: string[] }>;
  cards: StoreCard[];
  company: {
    netToday: number;
    paceDelta: number | null;
    projFinish: number | null;
    projEodLaborPct: number | null;
    laborTargetPct: number;
    needAttention: number;
  };
  stores: StoreSalesRow[];
}

export function SalesDashboard({ data }: { data: SalesDashboardData }) {
  if (!data.configured) {
    return (
      <div className="rounded-xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground">
        Add Toast API credentials to see sales &amp; labor. (Secrets live in App Hosting.)
      </div>
    );
  }

  const c = data.combined;

  return (
    <div className="space-y-6">
      {/* Slim company bar */}
      <section className="dash-rise rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{data.dateLabel}</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
              {data.greeting}
              {data.userName ? `, ${data.userName}` : ""}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <CompanyStat label="Net sales today" value={money.format(c.todaySales)} />
            <CompanyStat
              label="vs plan"
              value={data.company.paceDelta != null ? pct(data.company.paceDelta) : "—"}
              tone={paceTone(c.intradayPacePct)}
            />
            <CompanyStat
              label="Proj. EOD labor"
              value={data.company.projEodLaborPct != null ? `${data.company.projEodLaborPct.toFixed(1)}%` : "—"}
              tone={laborTone(data.company.projEodLaborPct, data.company.laborTargetPct)}
              sub={`target ${data.company.laborTargetPct}%`}
            />
            <CompanyStat
              label="Need attention"
              value={String(data.company.needAttention)}
              tone={data.company.needAttention > 0 ? "warning" : "success"}
            />
          </div>
        </div>
        <DataHealthChip health={data.dataHealth} />
      </section>

      {/* Store pulse grid */}
      <StorePulseGrid cards={data.cards} />

      {/* Charts */}
      {(data.hourly || data.week) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.hourly && (
            <section className="dash-rise rounded-xl border border-border/80 bg-card p-4">
              <HourlyChart data={data.hourly} />
            </section>
          )}
          {data.week && (
            <section className="dash-rise rounded-xl border border-border/80 bg-card p-4">
              <WeekChart days={data.week.days} todayIndex={data.week.todayIndex} />
            </section>
          )}
        </div>
      )}

      {/* Per-store table */}
      <section className="dash-rise overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="border-b border-border/70 bg-muted/30 px-4 py-2.5">
          <h2 className="text-sm font-semibold">By store</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[11px] font-medium text-muted-foreground">
                <Th className="pl-4">Store</Th>
                <Th align="right">Today</Th>
                <Th>Hourly</Th>
                <Th align="right">vs plan</Th>
                <Th align="right">Finish</Th>
                <Th align="right">Week to date</Th>
                <Th align="right">This wk proj.</Th>
                <Th align="right">YoY</Th>
                <Th align="right" className="pr-4">Labor %</Th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s) => (
                <tr key={s.guid} className="border-b border-border/50 last:border-b-0 hover:bg-accent/20">
                  <td className="py-2.5 pl-4 font-medium">
                    {shortName(s.name)}
                    {!s.hasToastData ? <span className="ml-1.5 rounded bg-warning/15 px-1 py-0.5 text-[9px] font-medium text-warning-foreground align-middle">no data</span> : null}
                  </td>
                  <Td align="right">{money.format(s.todaySales)}</Td>
                  <td className="px-2 py-2.5"><Sparkline values={s.sparkline} /></td>
                  <Td align="right">
                    <span className={cn("tabular-nums", toneClass(paceTone(s.intradayPacePct)))}>
                      {s.intradayPacePct != null ? pct(s.intradayPacePct - 100) : "—"}
                    </span>
                  </Td>
                  <Td align="right">{s.projFinishToday != null ? money.format(s.projFinishToday) : "—"}</Td>
                  <Td align="right">{money.format(s.wtdSales)}</Td>
                  <Td align="right">{s.projThisWeek != null ? money.format(s.projThisWeek) : "—"}</Td>
                  <Td align="right">
                    {s.yoyPct != null ? (
                      <span className={cn("inline-flex items-center gap-0.5 tabular-nums", s.yoyPct >= 0 ? "text-success" : "text-destructive")}>
                        {s.yoyPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {pct(s.yoyPct)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground" title="No sales a year ago (new or closed)">
                        <Minus className="inline h-3 w-3" />
                      </span>
                    )}
                  </Td>
                  <Td align="right" className="pr-4">
                    <span className={cn("tabular-nums", toneClass(laborTone(s.todayLaborPct, s.laborTargetPct)))}>
                      {s.todayLaborPct != null ? `${s.todayLaborPct.toFixed(0)}%` : "—"}
                    </span>
                    <span className="ml-1 text-[10px] text-muted-foreground">/{s.laborTargetPct}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology */}
      <details className="dash-rise rounded-xl border border-border/80 bg-card p-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-muted-foreground">
          <Info className="h-4 w-4" /> How these numbers are calculated
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Projection</span> = last year (same week) × 60% + a weighted
            average of the last 4 weeks × 40% (recent weeks weighted 40/30/20/10). A day under $50 counts as
            closed/no-data and is dropped, with weights redistributed — so a newer store with no history last year falls
            back to 100% recent average.
          </p>
          <p>
            <span className="font-medium text-foreground">Pace</span> compares completed days this week to the projection
            for those same days. <span className="font-medium text-foreground">YoY</span> compares completed days this
            week to the same days last year (stores with no last-year data show “—”).{" "}
            <span className="font-medium text-foreground">Labor %</span> = today’s labor cost ÷ today’s sales.
          </p>
          {data.anyForecast ? (
            data.stores.some((s) => s.notes.some((n) => !n.startsWith("Standard"))) ? (
              <div>
                <p className="font-medium text-foreground">Per-store notes:</p>
                <ul className="mt-1 space-y-0.5">
                  {data.stores
                    .filter((s) => s.notes.some((n) => !n.startsWith("Standard")))
                    .map((s) => (
                      <li key={s.guid}>
                        {shortName(s.name)}: {[...new Set(s.notes)].join("; ")}
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <p>All stores used the standard blend (last-year + recent data available).</p>
            )
          ) : (
            <p className="text-warning-foreground">
              Forecast not computed yet — it runs automatically Monday 4:00 AM. Projections/YoY will appear after the
              first run.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}

function DataHealthChip({ health }: { health: SalesDashboardData["dataHealth"] }) {
  const issues: string[] = [];
  if (health.noDataStores.length) issues.push(`${health.noDataStores.length} no Toast data`);
  if (health.noSlingStores.length) issues.push(`${health.noSlingStores.length} no Sling match`);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Activity className="h-3 w-3" /> Updated {health.updatedLabel}
      </span>
      {issues.length ? (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-warning-foreground"
          title={[
            health.noDataStores.length ? `No Toast data: ${health.noDataStores.join(", ")}` : "",
            health.noSlingStores.length ? `No Sling match: ${health.noSlingStores.join(", ")}` : "",
          ].filter(Boolean).join(" · ")}
        >
          <AlertTriangle className="h-3 w-3" /> {issues.join(" · ")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-success">
          <CheckCircle2 className="h-3 w-3" /> all stores reporting
        </span>
      )}
    </div>
  );
}

function CompanyStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums leading-tight", toneClass(tone))}>{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Th({ children, align, className }: { children: React.ReactNode; align?: "right"; className?: string }) {
  return <th className={cn("px-2 py-2 font-medium", align === "right" && "text-right", className)}>{children}</th>;
}
function Td({ children, align, className }: { children: React.ReactNode; align?: "right"; className?: string }) {
  return <td className={cn("px-2 py-2.5 tabular-nums", align === "right" && "text-right", className)}>{children}</td>;
}

type Tone = "success" | "warning" | "destructive" | undefined;

function toneClass(tone: Tone): string {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning-foreground";
  if (tone === "destructive") return "text-destructive";
  return "text-foreground";
}

function paceTone(pacePct: number | null): Tone {
  if (pacePct == null) return undefined;
  if (pacePct >= 100) return "success";
  if (pacePct >= 90) return "warning";
  return "destructive";
}

function laborTone(laborPct: number | null, target: number): Tone {
  if (laborPct == null) return undefined;
  if (laborPct <= target) return "success";
  if (laborPct <= target + 5) return "warning";
  return "destructive";
}

function pct(v: number): string {
  const r = Math.round(v);
  return `${r >= 0 ? "+" : ""}${r}%`;
}

function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}
