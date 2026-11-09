// Server-rendered inline-SVG charts for the sales dashboard. No client JS, no
// hydration — they stream with the RSC and theme via CSS variables. Hover text
// comes from native SVG <title> elements.
//
// Color plan (see the dataviz skill): one hue — `--info` (blue) for "actual /
// this year" — against neutral greys for "projected" (reference) and "last
// year" (ghost). Status hues (success/warning/destructive) stay reserved for
// labor tone elsewhere.

const INFO = "hsl(var(--info))";
const INFO_SOFT = "hsl(var(--info) / 0.14)";
const GREY = "hsl(var(--muted-foreground))";
const GREY_SOFT = "hsl(var(--muted-foreground) / 0.10)";
const GRID = "hsl(var(--border))";

const compactMoney = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${Math.round(v)}`;
const fullMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? "a" : "p";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${ampm}`;
}

export interface HourlyData {
  startHour: number;
  endHour: number; // inclusive
  actual: number[]; // index = hour 0..23, combined $
  projected: number[];
  nowHour: number; // fractional
}

export interface WeekDayBar {
  weekday: string;
  projected: number;
  actual: number | null; // null = day not started yet
  lastYear: number;
}

// ─────────────────────────────── Hourly chart ───────────────────────────────

export function HourlyChart({ data }: { data: HourlyData }) {
  const { startHour, endHour, actual, projected, nowHour } = data;
  const W = 720;
  const H = 240;
  const pad = { top: 18, right: 14, bottom: 26, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const span = Math.max(1, endHour - startHour);

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  const yMax = niceMax(Math.max(1, ...actual, ...projected));
  const x = (h: number) => pad.left + ((h - startHour) / span) * plotW;
  const y = (v: number) => pad.top + plotH - (Math.max(0, v) / yMax) * plotH;
  const baseY = pad.top + plotH;

  const projLinePts = hours.map((h) => `${x(h)},${y(projected[h] ?? 0)}`).join(" ");
  const projArea = `M${x(startHour)},${baseY} L${hours.map((h) => `${x(h)},${y(projected[h] ?? 0)}`).join(" L")} L${x(endHour)},${baseY} Z`;

  // Only plot hours that have fully elapsed — the in-progress hour would dip
  // below trend just because it isn't finished.
  const actualHours = hours.filter((h) => h + 1 <= nowHour);
  const actualLinePts = actualHours.map((h) => `${x(h)},${y(actual[h] ?? 0)}`).join(" ");
  const actualArea =
    actualHours.length > 1
      ? `M${x(actualHours[0])},${baseY} L${actualHours.map((h) => `${x(h)},${y(actual[h] ?? 0)}`).join(" L")} L${x(actualHours[actualHours.length - 1])},${baseY} Z`
      : "";

  // x ticks: ~6 across the span
  const tickStep = Math.max(1, Math.round(span / 6));
  const xTicks = hours.filter((h) => (h - startHour) % tickStep === 0);
  const yTicks = [0, yMax / 2, yMax];

  const empty = actual.every((v) => !v) && projected.every((v) => !v);

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Today · sales by hour</span>
        <Legend />
      </figcaption>
      {empty ? (
        <EmptyPlot label="No hourly data yet today." />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Hourly sales today versus forecast">
          {/* y gridlines + labels */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} opacity={i === 0 ? 1 : 0.5} />
              <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {compactMoney(v)}
              </text>
            </g>
          ))}
          {/* projected */}
          <path d={projArea} fill={GREY_SOFT} />
          <polyline points={projLinePts} fill="none" stroke={GREY} strokeWidth={2} strokeDasharray="4 4" strokeLinejoin="round" />
          {/* actual */}
          {actualArea ? <path d={actualArea} fill={INFO_SOFT} /> : null}
          {actualLinePts ? <polyline points={actualLinePts} fill="none" stroke={INFO} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {actualHours.length ? <circle cx={x(actualHours[actualHours.length - 1])} cy={y(actual[actualHours[actualHours.length - 1]] ?? 0)} r={3.5} fill={INFO} /> : null}
          {/* now line */}
          {nowHour >= startHour && nowHour <= endHour ? (
            <g>
              <line x1={x(nowHour)} x2={x(nowHour)} y1={pad.top} y2={baseY} stroke={INFO} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
              <text x={x(nowHour)} y={pad.top - 6} textAnchor="middle" className="fill-info text-[9px] font-medium">now</text>
            </g>
          ) : null}
          {/* x labels */}
          {xTicks.map((h) => (
            <text key={h} x={x(h)} y={baseY + 16} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {hourLabel(h)}
            </text>
          ))}
          {/* hover hotspots */}
          {hours.map((h) => {
            const w = plotW / span;
            return (
              <rect key={h} x={x(h) - w / 2} y={pad.top} width={w} height={plotH} fill="transparent">
                <title>{`${hourLabel(h)} — actual ${fullMoney.format(actual[h] ?? 0)} · forecast ${fullMoney.format(projected[h] ?? 0)}`}</title>
              </rect>
            );
          })}
        </svg>
      )}
    </figure>
  );
}

// ─────────────────────────────── Weekly chart ───────────────────────────────

export function WeekChart({ days, todayIndex }: { days: WeekDayBar[]; todayIndex: number }) {
  const W = 720;
  const H = 240;
  const pad = { top: 18, right: 14, bottom: 26, left: 46 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const yMax = niceMax(Math.max(1, ...days.flatMap((d) => [d.projected, d.actual ?? 0, d.lastYear])));
  const groupW = plotW / days.length;
  const barW = Math.min(26, groupW * 0.3);
  const gap = 4;
  const y = (v: number) => pad.top + plotH - (Math.max(0, v) / yMax) * plotH;
  const baseY = pad.top + plotH;
  const yTicks = [0, yMax / 2, yMax];

  const empty = days.every((d) => !d.projected && !d.actual && !d.lastYear);

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">This week · projected vs actual</span>
        <Legend lastYear />
      </figcaption>
      {empty ? (
        <EmptyPlot label="No forecast yet — runs Monday 4 AM." />
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="This week projected versus actual sales by day">
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} opacity={i === 0 ? 1 : 0.5} />
              <text x={pad.left - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {compactMoney(v)}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = pad.left + groupW * i + groupW / 2;
            const projX = cx - (d.actual != null ? barW + gap / 2 : barW / 2);
            const actX = cx + gap / 2;
            const isToday = i === todayIndex;
            return (
              <g key={d.weekday}>
                {/* projected bar */}
                <rect x={projX} y={y(d.projected)} width={barW} height={baseY - y(d.projected)} rx={2} fill={GREY} opacity={0.38}>
                  <title>{`${d.weekday} — forecast ${fullMoney.format(d.projected)}`}</title>
                </rect>
                {/* actual bar */}
                {d.actual != null ? (
                  <rect x={actX} y={y(d.actual)} width={barW} height={baseY - y(d.actual)} rx={2} fill={INFO}>
                    <title>{`${d.weekday} — actual ${fullMoney.format(d.actual)} · forecast ${fullMoney.format(d.projected)}`}</title>
                  </rect>
                ) : null}
                {/* last-year notch */}
                {d.lastYear > 0 ? (
                  <line x1={cx - barW - gap / 2} x2={cx + barW + gap / 2} y1={y(d.lastYear)} y2={y(d.lastYear)} stroke={GREY} strokeWidth={1.5} strokeDasharray="3 2" opacity={0.75}>
                    <title>{`${d.weekday} — last year ${fullMoney.format(d.lastYear)}`}</title>
                  </line>
                ) : null}
                <text x={cx} y={baseY + 16} textAnchor="middle" className={isToday ? "fill-foreground text-[10px] font-semibold" : "fill-muted-foreground text-[10px]"}>
                  {d.weekday}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </figure>
  );
}

// ───────────────────────────────── Sparkline ────────────────────────────────

/** Tiny today's-shape sparkline for a table row. */
export function Sparkline({ values, width = 92, height = 24 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const n = values.length;
  if (!n || values.every((v) => !v)) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const y = (v: number) => height - (v / max) * (height - 2) - 1;
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `M0,${height} L${line} L${width},${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="inline-block align-middle" aria-hidden="true">
      <path d={area} fill={INFO_SOFT} />
      <polyline points={line} fill="none" stroke={INFO} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ───────────────────────────────── helpers ──────────────────────────────────

function Legend({ lastYear = false }: { lastYear?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-3 rounded-sm" style={{ background: INFO }} /> Actual
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-3 rounded-sm" style={{ background: GREY, opacity: 0.45 }} /> Forecast
      </span>
      {lastYear ? (
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0 w-3 border-t-[1.5px] border-dashed" style={{ borderColor: GREY }} /> Last yr
        </span>
      ) : null}
    </div>
  );
}

function EmptyPlot({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
      {label}
    </div>
  );
}
