// Server-rendered SVG panels for the store detail page. Theme via CSS vars,
// hover via native <title>. No chart library.

const INFO = "hsl(var(--info))";
const INFO_SOFT = "hsl(var(--info) / 0.14)";
const MUTE = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`);

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

export interface DailyPoint {
  date: string;
  label: string; // "Mon 3"
  actual: number | null; // null = future / no data
  expected: number; // forecast weekday baseline
  isToday: boolean;
}

/** 14-day daily net sales (bars) vs the forecast's per-weekday expectation (tick). */
export function DailySalesChart({ days }: { days: DailyPoint[] }) {
  const W = 720;
  const H = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const yMax = niceMax(Math.max(1, ...days.map((d) => Math.max(d.actual ?? 0, d.expected))));
  const groupW = plotW / days.length;
  const barW = Math.min(22, groupW * 0.6);
  const y = (v: number) => pad.top + plotH - (Math.max(0, v) / yMax) * plotH;
  const baseY = pad.top + plotH;
  const yTicks = [0, yMax / 2, yMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Daily net sales vs expected, last 14 days">
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} opacity={i === 0 ? 1 : 0.4} />
          <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{compact(v)}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const cx = pad.left + groupW * i + groupW / 2;
        return (
          <g key={d.date}>
            {d.actual != null ? (
              <rect x={cx - barW / 2} y={y(d.actual)} width={barW} height={baseY - y(d.actual)} rx={2} fill={d.isToday ? INFO_SOFT : INFO} opacity={d.isToday ? 1 : 0.85}>
                <title>{`${d.label} — ${money.format(d.actual)} (expected ${money.format(d.expected)})`}</title>
              </rect>
            ) : null}
            {d.expected > 0 ? (
              <line x1={cx - barW / 2 - 1} x2={cx + barW / 2 + 1} y1={y(d.expected)} y2={y(d.expected)} stroke={MUTE} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.8}>
                <title>{`${d.label} — expected ${money.format(d.expected)}`}</title>
              </line>
            ) : null}
            {i % 2 === 0 || d.isToday ? (
              <text x={cx} y={baseY + 14} textAnchor="middle" className={d.isToday ? "fill-foreground text-[8px] font-semibold" : "fill-muted-foreground text-[8px]"}>{d.label}</text>
            ) : null}
          </g>
        );
      })}
      <text x={pad.left} y={10} className="fill-muted-foreground text-[9px]">bars = actual · dashed = expected</text>
    </svg>
  );
}

/** Weekly net-sales trend (bars) with week-over-week labels. */
export function WeeklyTrendChart({ weeks }: { weeks: Array<{ label: string; total: number; wowPct: number | null }> }) {
  const W = 720;
  const H = 180;
  const pad = { top: 16, right: 12, bottom: 24, left: 44 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const yMax = niceMax(Math.max(1, ...weeks.map((w) => w.total)));
  const groupW = plotW / Math.max(1, weeks.length);
  const barW = Math.min(48, groupW * 0.5);
  const y = (v: number) => pad.top + plotH - (Math.max(0, v) / yMax) * plotH;
  const baseY = pad.top + plotH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Weekly net sales trend">
      {[0, yMax / 2, yMax].map((v, i) => (
        <g key={i}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} opacity={i === 0 ? 1 : 0.4} />
          <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{compact(v)}</text>
        </g>
      ))}
      {weeks.map((w, i) => {
        const cx = pad.left + groupW * i + groupW / 2;
        const last = i === weeks.length - 1;
        return (
          <g key={w.label}>
            <rect x={cx - barW / 2} y={y(w.total)} width={barW} height={baseY - y(w.total)} rx={2} fill={INFO} opacity={last ? 1 : 0.55}>
              <title>{`${w.label} — ${money.format(w.total)}${w.wowPct != null ? ` (${w.wowPct >= 0 ? "+" : ""}${Math.round(w.wowPct)}% WoW)` : ""}`}</title>
            </rect>
            <text x={cx} y={y(w.total) - 4} textAnchor="middle" className="fill-muted-foreground text-[8px]">{compact(w.total)}</text>
            {w.wowPct != null ? (
              <text x={cx} y={baseY + 15} textAnchor="middle" className={w.wowPct >= 0 ? "fill-success text-[8px]" : "fill-destructive text-[8px]"}>{`${w.wowPct >= 0 ? "+" : ""}${Math.round(w.wowPct)}%`}</text>
            ) : null}
            <text x={cx} y={baseY + (w.wowPct != null ? 24 : 15)} textAnchor="middle" className="fill-muted-foreground text-[8px]">{w.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export interface CompareRow {
  label: string;
  store: number | null;
  company: number | null;
  unit: "%" | "$" | "pts";
  betterHigh: boolean; // higher is better?
}

/** This store vs the company average, per metric. */
export function VsCompany({ rows }: { rows: CompareRow[] }) {
  const fmt = (v: number | null, unit: CompareRow["unit"]) =>
    v == null ? "—" : unit === "$" ? `$${Math.round(v)}` : unit === "%" ? `${v.toFixed(0)}%` : String(Math.round(v));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[10px] text-muted-foreground">
          <th className="py-1 font-medium">Metric</th>
          <th className="py-1 text-right font-medium">This store</th>
          <th className="py-1 text-right font-medium">Company avg</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const better = r.store != null && r.company != null && (r.betterHigh ? r.store >= r.company : r.store <= r.company);
          return (
            <tr key={r.label} className="border-t border-border/40">
              <td className="py-1.5 text-muted-foreground">{r.label}</td>
              <td className={`py-1.5 text-right font-medium tabular-nums ${r.store == null ? "text-muted-foreground" : better ? "text-success" : "text-warning-foreground"}`}>{fmt(r.store, r.unit)}</td>
              <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fmt(r.company, r.unit)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
