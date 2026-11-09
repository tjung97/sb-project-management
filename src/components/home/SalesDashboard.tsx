import { TrendingUp, TrendingDown, DollarSign, CalendarRange, Users, Minus, Info } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { HourlyChart, WeekChart, Sparkline, type HourlyData, type WeekDayBar } from "@/src/components/home/SalesVisuals";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export interface StoreSalesRow {
  guid: string;
  name: string;
  todaySales: number;
  wtdSales: number;
  projThisWeek: number | null;
  projNextWeek: number | null;
  pacePct: number | null; // week-to-date vs projected-to-date (completed days)
  yoyPct: number | null; // completed days vs last year same days
  lyHasData: boolean;
  todayLaborPct: number | null;
  laborTargetPct: number;
  notes: string[];
  computedAt: string | null;
  sparkline: number[]; // today's actual sales by hour (business range)
}

export interface SalesDashboardData {
  greeting: string;
  userName: string;
  dateLabel: string;
  configured: boolean;
  anyForecast: boolean;
  combined: {
    todaySales: number;
    wtdSales: number;
    projThisWeek: number | null;
    projNextWeek: number | null;
    laborPct: number | null;
    laborTargetPct: number;
    yoyPct: number | null;
    pacePct: number | null;
  };
  hourly: HourlyData | null;
  week: { days: WeekDayBar[]; todayIndex: number } | null;
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
      <section className="dash-hero dash-rise rounded-2xl border border-border/70 p-5 sm:p-6">
        <p className="text-xs font-medium text-muted-foreground">{data.dateLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {data.greeting}
          {data.userName ? `, ${data.userName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All stores · {money.format(c.todaySales)} today · {money.format(c.wtdSales)} week to date
        </p>
      </section>

      {/* Combined KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Today's sales" value={money.format(c.todaySales)} icon={<DollarSign className="h-4 w-4" />} />
        <Kpi
          label="Projected this week"
          value={c.projThisWeek != null ? money.format(c.projThisWeek) : "—"}
          sub={c.pacePct != null ? paceLabel(c.pacePct) : "pace pending"}
          subTone={paceTone(c.pacePct)}
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <Kpi
          label="vs last year"
          value={c.yoyPct != null ? pct(c.yoyPct) : "—"}
          valueTone={c.yoyPct == null ? undefined : c.yoyPct >= 0 ? "success" : "destructive"}
          sub={c.yoyPct != null ? "week to date" : "no last-year data"}
          icon={c.yoyPct != null && c.yoyPct < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
        />
        <Kpi
          label="Labor % (today)"
          value={c.laborPct != null ? `${c.laborPct.toFixed(1)}%` : "—"}
          valueTone={laborTone(c.laborPct, c.laborTargetPct)}
          sub={`target ${c.laborTargetPct}%`}
          icon={<Users className="h-4 w-4" />}
        />
        <Kpi
          label="Projected next week"
          value={c.projNextWeek != null ? money.format(c.projNextWeek) : "—"}
          icon={<CalendarRange className="h-4 w-4" />}
        />
        <Kpi label="Week to date" value={money.format(c.wtdSales)} icon={<DollarSign className="h-4 w-4" />} />
      </div>

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
                <Th align="right">Week to date</Th>
                <Th align="right">Pace</Th>
                <Th align="right">This wk proj.</Th>
                <Th align="right">Next wk proj.</Th>
                <Th align="right">YoY</Th>
                <Th align="right" className="pr-4">Labor %</Th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s) => (
                <tr key={s.guid} className="border-b border-border/50 last:border-b-0 hover:bg-accent/20">
                  <td className="py-2.5 pl-4 font-medium">{shortName(s.name)}</td>
                  <Td align="right">{money.format(s.todaySales)}</Td>
                  <td className="px-2 py-2.5"><Sparkline values={s.sparkline} /></td>
                  <Td align="right">{money.format(s.wtdSales)}</Td>
                  <Td align="right">
                    <span className={cn("tabular-nums", toneClass(paceTone(s.pacePct)))}>
                      {s.pacePct != null ? `${Math.round(s.pacePct)}%` : "—"}
                    </span>
                  </Td>
                  <Td align="right">{s.projThisWeek != null ? money.format(s.projThisWeek) : "—"}</Td>
                  <Td align="right">{s.projNextWeek != null ? money.format(s.projNextWeek) : "—"}</Td>
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

function Kpi({
  label,
  value,
  sub,
  subTone,
  valueTone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: Tone;
  valueTone?: Tone;
  icon?: React.ReactNode;
}) {
  return (
    <div className="dash-card rounded-xl border border-border/80 bg-card p-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{label}</span>
        {icon}
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass(valueTone))}>{value}</p>
      {sub ? <p className={cn("mt-0.5 text-[11px]", subTone ? toneClass(subTone) : "text-muted-foreground")}>{sub}</p> : null}
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

function paceLabel(pacePct: number): string {
  const diff = Math.round(pacePct - 100);
  if (diff === 0) return "on pace";
  return diff > 0 ? `+${diff}% vs plan` : `${diff}% vs plan`;
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
