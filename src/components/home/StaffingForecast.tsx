"use client";

import { useState } from "react";
import { Users, TriangleAlert, Check, Info, ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { StaffingForecast as StaffingData, StoreStaffing, StaffDay } from "@/src/lib/ops/staffing";
import type { FitGrade } from "@/src/lib/ops/staffing-math";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const SHORT = "hsl(var(--warning))"; // understaffed / short
const EXTRA = "hsl(var(--info))"; // overstaffed / extra
const INK = "hsl(var(--foreground))";
const MUTE = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--border))";

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? "a" : "p";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${ampm}`;
}
function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}
function minLabel(min: number) {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return m === 0 ? hourLabel(h) : `${hourLabel(h).replace(/[ap]$/, "")}:${String(m).padStart(2, "0")}${h < 12 ? "a" : "p"}`;
}

export function StaffingForecast({ data }: { data: StaffingData }) {
  const [view, setView] = useState<"today" | "next7">("today");
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!data.configured) return null;

  return (
    <section className="dash-rise overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-2.5">
        <Users className="h-4 w-4 text-info" />
        <h2 className="text-sm font-semibold">Staffing vs forecast</h2>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border/70 bg-background p-0.5 text-[11px]">
          <button type="button" onClick={() => setView("today")} className={cn("rounded-md px-2 py-0.5 font-medium", view === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            Today
          </button>
          <button type="button" onClick={() => setView("next7")} className={cn("rounded-md px-2 py-0.5 font-medium", view === "next7" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            Next 7 days
          </button>
        </div>
      </div>

      {view === "today" ? (
        <div className="divide-y divide-border/50">
          {data.stores.map((s) => (
            <TodayRow key={s.guid} store={s} open={expanded === s.guid} onToggle={() => setExpanded((e) => (e === s.guid ? null : s.guid))} />
          ))}
        </div>
      ) : (
        <Next7Grid stores={data.stores} />
      )}

      <Legend />
    </section>
  );
}

// ───────────────────────────── Today — per store ────────────────────────────

function TodayRow({ store, open, onToggle }: { store: StoreStaffing; open: boolean; onToggle: () => void }) {
  const day = store.days[0];
  const noData = !store.matched || !day || day.result.scheduledHours + day.result.prepHours === 0;

  return (
    <div className="px-4 py-3">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <span className="text-sm font-medium">{shortName(store.name)}</span>
        {noData ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {store.matched ? "No shifts today" : "No Sling schedule matched"}
          </span>
        ) : (
          <>
            <FitBadge grade={day.result.grade} score={day.result.fitScore} />
            <LaborBadge pct={day.result.projectedLaborPct} target={day.targetPct} />
          </>
        )}
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {!noData && day ? (
        <>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {day.result.summary}
            {day.result.prepHours > 0 ? ` · ${day.result.prepHours} prep hr${day.result.prepHours === 1 ? "" : "s"}` : ""}
          </p>
          <DayChart day={day} expanded={open} />
        </>
      ) : null}
    </div>
  );
}

// ───────────────────────────── The 3-row chart ──────────────────────────────

export function DayChart({ day, expanded }: { day: StaffDay; expanded: boolean }) {
  const hrs = day.result.hours;
  if (!hrs.length) return null;
  const minH = Math.min(...hrs.map((h) => h.hour));
  const maxH = Math.max(...hrs.map((h) => h.hour));
  const span = Math.max(1, maxH + 1 - minH);
  const byHour = new Map(hrs.map((h) => [h.hour, h]));

  const W = 720;
  const padL = 26;
  const padR = 10;
  const plotW = W - padL - padR;
  const x = (h: number) => padL + ((h - minH) / span) * plotW;

  const maxStaff = Math.max(3, ...hrs.map((h) => Math.max(h.required, h.scheduled)));
  const stripH = expanded ? 34 : 0;
  const mainH = 104;
  const topPad = 6;
  const mainTop = topPad + stripH;
  const baseY = mainTop + mainH;
  const y = (v: number) => baseY - (v / maxStaff) * mainH;

  const maxFc = Math.max(1, ...hrs.map((h) => h.forecast));

  const openHours = hrs.filter((h) => h.open).map((h) => h.hour);
  const reqStep = stepPath(openHours, (h) => byHour.get(h)?.required ?? 0, x, y);
  const schedAll = hrs.map((h) => h.hour);
  const schedStep = stepPath(schedAll, (h) => byHour.get(h)?.scheduled ?? 0, x, y);

  // Shift bars (expanded): one row each.
  const shifts = day.shifts;
  const shiftRowH = 13;
  const shiftsTop = baseY + 26;
  const shiftsH = expanded && shifts.length ? shifts.length * shiftRowH + 6 : 0;
  const H = shiftsTop + shiftsH + (expanded && shifts.length ? 4 : -10);

  const yTicks = maxStaff <= 5 ? Array.from({ length: maxStaff + 1 }, (_, i) => i) : [0, Math.ceil(maxStaff / 2), maxStaff];

  return (
    <svg viewBox={`0 0 ${W} ${Math.max(H, baseY + 6)}`} className="mt-1 h-auto w-full" role="img" aria-label={`Required vs scheduled staff for ${day.weekday}`}>
      {/* forecast strip (expanded) */}
      {expanded
        ? hrs.map((h) => {
            const bw = (plotW / span) * 0.7;
            const bx = x(h.hour) + (plotW / span) * 0.15;
            const bh = (h.forecast / maxFc) * (stripH - 6);
            return (
              <g key={`fc-${h.hour}`}>
                <rect x={bx} y={topPad + (stripH - 6 - bh)} width={bw} height={Math.max(0, bh)} rx={1} fill={MUTE} opacity={0.3} />
                {h.actual != null ? <line x1={bx} x2={bx + bw} y1={topPad + (stripH - 6 - (h.actual / maxFc) * (stripH - 6))} y2={topPad + (stripH - 6 - (h.actual / maxFc) * (stripH - 6))} stroke={INK} strokeWidth={1.5} /> : null}
              </g>
            );
          })
        : null}
      {expanded ? <text x={padL} y={topPad + 7} className="fill-muted-foreground text-[8px]">forecast $ / hr{hrs.some((h) => h.actual != null) ? " · — actual" : ""}</text> : null}

      {/* y gridlines */}
      {yTicks.map((v) => (
        <g key={`y-${v}`}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth={1} opacity={v === 0 ? 1 : 0.4} />
          <text x={padL - 5} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{v}</text>
        </g>
      ))}

      {/* prep (side-work) columns, hatched */}
      {hrs.filter((h) => !h.open && h.scheduled > 0.05).map((h) => (
        <g key={`prep-${h.hour}`}>
          <rect x={x(h.hour)} y={y(h.scheduled)} width={plotW / span} height={baseY - y(h.scheduled)} fill="url(#prepHatch)" opacity={0.5} />
        </g>
      ))}

      {/* gap fills with signed labels */}
      {hrs.filter((h) => h.open && (h.status === "over" || h.status === "under")).map((h) => {
        const yReq = y(h.required);
        const ySch = y(h.scheduled);
        const top = Math.min(yReq, ySch);
        const colW = plotW / span;
        return (
          <g key={`gap-${h.hour}`}>
            <rect x={x(h.hour) + 1} y={top} width={colW - 2} height={Math.abs(yReq - ySch)} rx={2} fill={h.status === "under" ? SHORT : EXTRA} opacity={0.3} />
            <text x={x(h.hour) + colW / 2} y={top + Math.abs(yReq - ySch) / 2 + 3} textAnchor="middle" className="text-[9px] font-semibold" fill={h.status === "under" ? SHORT : EXTRA}>
              {h.gap > 0 ? `+${Math.round(h.gap)}` : Math.round(h.gap)}
            </text>
          </g>
        );
      })}

      {/* required (dashed) + scheduled (solid) step lines */}
      <path d={reqStep} fill="none" stroke={MUTE} strokeWidth={1.75} strokeDasharray="4 3" strokeLinejoin="round" />
      <path d={schedStep} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />

      {/* x labels */}
      {hrs.filter((_, i) => i % Math.ceil(hrs.length / 8 || 1) === 0 || i === hrs.length - 1).map((h) => (
        <text key={`x-${h.hour}`} x={x(h.hour) + (plotW / span) / 2} y={baseY + 12} textAnchor="middle" className="fill-muted-foreground text-[8px]">{hourLabel(h.hour)}</text>
      ))}

      {/* hover hotspots */}
      {hrs.map((h) => (
        <rect key={`hit-${h.hour}`} x={x(h.hour)} y={mainTop} width={plotW / span} height={mainH} fill="transparent">
          <title>{`${hourLabel(h.hour)} — forecast ${money.format(h.forecast)}${h.actual != null ? ` · actual ${money.format(h.actual)}` : ""}\nrequired ${h.open ? h.required : "—"} · scheduled ${h.scheduled}${h.open ? ` · ${h.gap >= 0 ? "+" : ""}${h.gap}` : " (prep)"}`}</title>
        </rect>
      ))}

      {/* shift bars (expanded) */}
      {expanded && shifts.length
        ? shifts.map((s, i) => {
            const sx = x(s.startMin / 60);
            const ex = x(Math.min(s.endMin, (maxH + 1) * 60) / 60);
            const ry = shiftsTop + i * shiftRowH;
            return (
              <g key={`sh-${i}`}>
                <rect x={sx} y={ry} width={Math.max(2, ex - sx)} height={shiftRowH - 4} rx={2} fill={s.status === "published" ? INK : MUTE} opacity={s.status === "published" ? 0.55 : 0.3}>
                  <title>{`${s.user || s.position || "Shift"} · ${minLabel(s.startMin)}–${minLabel(s.endMin)}${s.breakMin ? ` · ${s.breakMin}m break` : ""}${s.status !== "published" ? " · draft" : ""}`}</title>
                </rect>
                <text x={sx + 3} y={ry + shiftRowH - 7} className="fill-background text-[8px] font-medium">{shortName(s.user || s.position || "")}</text>
              </g>
            );
          })
        : null}

      <defs>
        <pattern id="prepHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="5" stroke={MUTE} strokeWidth="1.5" />
        </pattern>
      </defs>
    </svg>
  );
}

function stepPath(hoursAsc: number[], v: (h: number) => number, x: (h: number) => number, y: (v: number) => number): string {
  if (!hoursAsc.length) return "";
  const hs = [...hoursAsc].sort((a, b) => a - b);
  let d = `M ${x(hs[0])} ${y(v(hs[0]))}`;
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    d += ` L ${x(h + 1)} ${y(v(h))}`;
    const next = hs[i + 1];
    if (next != null) {
      if (next === h + 1) d += ` L ${x(next)} ${y(v(next))}`;
      else d += ` L ${x(h + 1)} ${y(0)} L ${x(next)} ${y(0)} L ${x(next)} ${y(v(next))}`;
    }
  }
  return d;
}

// ───────────────────────────── Next 7 days grid ─────────────────────────────

function Next7Grid({ stores }: { stores: StoreStaffing[] }) {
  const cols = stores[0]?.days.slice(1) ?? [];
  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="px-2 py-1 text-left font-medium">Store</th>
            {cols.map((d) => (
              <th key={d.date} className="px-1 py-1 text-center font-medium">{d.weekday}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <tr key={s.guid} className="border-t border-border/40">
              <td className="whitespace-nowrap px-2 py-1 font-medium">{shortName(s.name)}</td>
              {s.days.slice(1).map((d) => (
                <td key={d.date} className="px-1 py-1 text-center">
                  <GridCell day={d} matched={s.matched} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridCell({ day, matched }: { day: StaffDay; matched: boolean }) {
  const empty = !matched || day.result.scheduledHours + day.result.prepHours === 0;
  if (empty) return <div className="rounded-md bg-muted/40 py-1 text-[10px] text-muted-foreground">{day.hasForecast ? "—" : "·"}</div>;
  const g = day.result.grade;
  const bg = g === "good" ? "bg-success/15 text-success" : g === "ok" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/15 text-destructive";
  return (
    <div className={cn("rounded-md px-1 py-1 leading-tight", bg)} title={`${day.weekday} · fit ${day.result.fitScore} · labor ${day.result.projectedLaborPct ?? "—"}% vs ${day.targetPct}%${day.posted ? "" : " · draft"}`}>
      <div className="text-[11px] font-semibold tabular-nums">{day.result.fitScore}</div>
      <div className="text-[9px] tabular-nums">{day.result.projectedLaborPct != null ? `${Math.round(day.result.projectedLaborPct)}%` : "—"}</div>
    </div>
  );
}

// ───────────────────────────── bits ─────────────────────────────

function FitBadge({ grade, score }: { grade: FitGrade; score: number }) {
  const cls = grade === "good" ? "bg-success/15 text-success" : grade === "ok" ? "bg-warning/15 text-warning-foreground" : "bg-destructive/15 text-destructive";
  const Icon = grade === "good" ? Check : TriangleAlert;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>
      <Icon className="h-3 w-3" /> fit {score}
    </span>
  );
}

function LaborBadge({ pct, target }: { pct: number | null; target: number }) {
  if (pct == null) return null;
  const over = pct > target + 2;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", over ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>
      labor {Math.round(pct)}% / {target}%
    </span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-3 border-t-2 border-dashed" style={{ borderColor: MUTE }} /> Required</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-0 w-3 border-t-2" style={{ borderColor: INK }} /> Scheduled</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: SHORT, opacity: 0.4 }} /> Short</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ background: EXTRA, opacity: 0.4 }} /> Extra</span>
      <span className="ml-auto inline-flex items-center gap-1"><Info className="h-3 w-3" /> Tap a store to expand</span>
    </div>
  );
}
