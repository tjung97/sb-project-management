"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Minus, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const INFO = "hsl(var(--info))";
const MUTE = "hsl(var(--muted-foreground))";

export interface StoreCard {
  guid: string;
  name: string;
  status: "attention" | "ok" | "good" | "nodata";
  why: string;
  netToday: number;
  pacePct: number | null;
  paceDelta: number | null;
  projFinish: number | null;
  busyIndex: number | null;
  projEodLaborPct: number | null;
  liveLaborPct: number | null;
  laborTargetPct: number;
  laborDeltaDollars: number | null;
  splhToday: number | null;
  fitScore: number | null;
  misplacedHours: number | null;
  sparkActual: number[];
  sparkForecast: number[];
  nowIndex: number;
  trendWeeks: number[];
  trendWowPct: number | null;
  hasToastData: boolean;
}

type SortKey = "attention" | "sales" | "pace" | "labor" | "fit";
const SORTS: Array<{ key: SortKey; label: string }> = [
  { key: "attention", label: "Needs attention" },
  { key: "sales", label: "Sales" },
  { key: "pace", label: "Pace" },
  { key: "labor", label: "Labor" },
  { key: "fit", label: "Fit" },
];

const statusRank = { attention: 0, nodata: 1, ok: 2, good: 3 } as const;
const nn = (v: number | null, fallback: number) => (v == null ? fallback : v);

function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}

export function StorePulseGrid({ cards }: { cards: StoreCard[] }) {
  const [sort, setSort] = useState<SortKey>("attention");

  const sorted = [...cards].sort((a, b) => {
    switch (sort) {
      case "sales":
        return b.netToday - a.netToday;
      case "pace":
        return nn(a.paceDelta, 9999) - nn(b.paceDelta, 9999); // behind first
      case "labor":
        return nn(b.projEodLaborPct, -1) - nn(a.projEodLaborPct, -1); // highest first
      case "fit":
        return nn(a.fitScore, 999) - nn(b.fitScore, 999); // worst first
      default:
        return statusRank[a.status] - statusRank[b.status] || b.netToday - a.netToday;
    }
  });

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Stores</h2>
        <div className="ml-auto flex items-center gap-1 overflow-x-auto rounded-lg border border-border/70 bg-background p-0.5 text-[11px]">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn("whitespace-nowrap rounded-md px-2 py-0.5 font-medium", sort === s.key ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((card) => (
          <StoreCardView key={card.guid} card={card} />
        ))}
      </div>
    </section>
  );
}

function StoreCardView({ card }: { card: StoreCard }) {
  return (
    <Link
      href={`/dashboard/store/${card.guid}`}
      className="group flex h-full flex-col rounded-xl border border-border/80 bg-card p-3 transition hover:border-foreground/25 hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold">{shortName(card.name)}</span>
        <StatusChip status={card.status} />
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums">{money.format(card.netToday)}</span>
        {card.paceDelta != null ? (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", card.paceDelta >= 0 ? "text-success" : "text-destructive")}>
            {card.paceDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {card.paceDelta >= 0 ? "+" : ""}
            {Math.round(card.paceDelta)}%
          </span>
        ) : null}
        <span className="ml-auto text-[10px] text-muted-foreground">vs forecast</span>
      </div>

      <MiniSpark actual={card.sparkActual} forecast={card.sparkForecast} nowIndex={card.nowIndex} />

      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Proj. labor</span>
            <span className={cn("tabular-nums", laborToneClass(card.projEodLaborPct, card.laborTargetPct))}>
              {card.projEodLaborPct != null ? `${card.projEodLaborPct.toFixed(0)}%` : "—"} / {card.laborTargetPct}%
            </span>
          </div>
          <LaborBullet pct={card.projEodLaborPct} target={card.laborTargetPct} />
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">SPLH</p>
          <p className="text-xs font-semibold tabular-nums">{card.splhToday != null ? `$${Math.round(card.splhToday)}` : "—"}</p>
        </div>
        <TrendBars weeks={card.trendWeeks} wow={card.trendWowPct} />
      </div>

      <p className="mt-auto pt-2 truncate text-[11px] text-muted-foreground" title={card.why}>{card.why}</p>
    </Link>
  );
}

// ── pieces ──────────────────────────────────────────────────────────────────

function MiniSpark({ actual, forecast, nowIndex }: { actual: number[]; forecast: number[]; nowIndex: number }) {
  const n = Math.max(actual.length, forecast.length);
  if (n < 2) return <div className="mt-2 h-8" />;
  const max = Math.max(1, ...actual, ...forecast);
  const W = 240;
  const H = 32;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 3) - 1.5;
  const fPts = forecast.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const aPts = actual.slice(0, nowIndex + 1).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const nowX = x(Math.max(0, Math.min(n - 1, nowIndex)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={fPts} fill="none" stroke={MUTE} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} vectorEffect="non-scaling-stroke" />
      {aPts ? <polyline points={aPts} fill="none" stroke={INFO} strokeWidth={1.75} strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
      <line x1={nowX} x2={nowX} y1={0} y2={H} stroke={INFO} strokeWidth={0.75} strokeDasharray="2 2" opacity={0.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function LaborBullet({ pct, target }: { pct: number | null; target: number }) {
  const scale = Math.max(target * 1.8, (pct ?? 0) * 1.15, 40);
  const fill = pct != null ? Math.min(100, (pct / scale) * 100) : 0;
  const tick = Math.min(100, (target / scale) * 100);
  const color = pct == null ? "bg-muted-foreground/40" : pct <= target ? "bg-success" : pct <= target + 5 ? "bg-warning" : "bg-destructive";
  return (
    <div className="relative mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${fill}%` }} />
      <div className="absolute top-0 h-full w-0.5 bg-foreground/70" style={{ left: `${tick}%` }} title={`target ${target}%`} />
    </div>
  );
}

function TrendBars({ weeks, wow }: { weeks: number[]; wow: number | null }) {
  const ordered = [...weeks].reverse(); // oldest → newest
  const max = Math.max(1, ...ordered);
  return (
    <div className="flex flex-col items-end">
      <div className="flex h-7 items-end gap-0.5">
        {ordered.length ? (
          ordered.map((v, i) => (
            <div key={i} className={cn("w-1.5 rounded-sm", i === ordered.length - 1 ? "bg-info" : "bg-muted-foreground/35")} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </div>
      <span className={cn("mt-0.5 text-[9px] tabular-nums", wow == null ? "text-muted-foreground" : wow >= 0 ? "text-success" : "text-destructive")}>
        {wow != null ? `${wow >= 0 ? "+" : ""}${Math.round(wow)}% wk` : "4wk"}
      </span>
    </div>
  );
}

function StatusChip({ status }: { status: StoreCard["status"] }) {
  const map = {
    attention: { cls: "bg-warning/15 text-warning-foreground", Icon: AlertTriangle, label: "Attention" },
    good: { cls: "bg-success/15 text-success", Icon: Check, label: "On track" },
    ok: { cls: "bg-muted text-muted-foreground", Icon: Minus, label: "OK" },
    nodata: { cls: "bg-muted text-muted-foreground", Icon: Minus, label: "No data" },
  } as const;
  const { cls, Icon, label } = map[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function laborToneClass(pct: number | null, target: number): string {
  if (pct == null) return "text-muted-foreground";
  if (pct <= target) return "text-success";
  if (pct <= target + 5) return "text-warning-foreground";
  return "text-destructive";
}
