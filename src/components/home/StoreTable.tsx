"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { StoreCard } from "@/src/components/home/StorePulseGrid";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const INFO = "hsl(var(--info))";
const MUTE = "hsl(var(--muted-foreground))";

type SortKey = "name" | "net" | "pace" | "labor" | "splh" | "fit" | "wow";

const shortName = (n: string) => n.replace(/^seoul bowl\s*-?\s*/i, "").trim() || n;
const val = (c: StoreCard, k: SortKey): number => {
  switch (k) {
    case "net": return c.netToday;
    case "pace": return c.paceDelta ?? -Infinity;
    case "labor": return c.projEodLaborPct ?? Infinity;
    case "splh": return c.splhToday ?? -Infinity;
    case "fit": return c.fitScore ?? -Infinity;
    case "wow": return c.trendWowPct ?? -Infinity;
    default: return 0;
  }
};

export function StoreTable({ cards }: { cards: StoreCard[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("net");
  const [dir, setDir] = useState<1 | -1>(-1);

  const sorted = [...cards].sort((a, b) => {
    if (sort === "name") return shortName(a.name).localeCompare(shortName(b.name)) * dir;
    return (val(a, sort) - val(b, sort)) * dir;
  });

  const click = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(k === "name" || k === "labor" ? 1 : -1);
    }
  };

  return (
    <section className="dash-rise overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-4 py-2.5">
        <h2 className="text-sm font-semibold">By store</h2>
        <LaborLegend />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-[11px] font-medium text-muted-foreground">
              <Th label="Store" k="name" sort={sort} dir={dir} onClick={click} className="pl-4" />
              <Th label="Net today" k="net" sort={sort} dir={dir} onClick={click} align />
              <Th label="vs plan" k="pace" sort={sort} dir={dir} onClick={click} align />
              <Th label="Today" plain />
              <Th label="Proj. labor" k="labor" sort={sort} dir={dir} onClick={click} align />
              <Th label="SPLH" k="splh" sort={sort} dir={dir} onClick={click} align />
              <Th label="Fit" k="fit" sort={sort} dir={dir} onClick={click} align />
              <Th label="4wk" k="wow" sort={sort} dir={dir} onClick={click} align className="pr-4" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.guid}
                onClick={() => router.push(`/dashboard/store/${c.guid}`)}
                className="cursor-pointer border-b border-border/50 last:border-b-0 hover:bg-accent/20"
              >
                <td className="py-2.5 pl-4 font-medium">
                  {shortName(c.name)}
                  {!c.hasToastData ? <span className="ml-1.5 rounded bg-warning/15 px-1 py-0.5 align-middle text-[9px] font-medium text-warning-foreground">no data</span> : null}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{money.format(c.netToday)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <span className={c.paceDelta == null ? "text-muted-foreground" : c.paceDelta >= 0 ? "text-success" : "text-destructive"}>
                    {c.paceDelta != null ? `${c.paceDelta >= 0 ? "+" : ""}${Math.round(c.paceDelta)}%` : "—"}
                  </span>
                </td>
                <td className="px-2 py-2.5"><Ghost actual={c.sparkActual} forecast={c.sparkForecast} /></td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  <span className={laborToneClass(c.projEodLaborPct, c.laborTargetPct)}>{c.projEodLaborPct != null ? `${Math.round(c.projEodLaborPct)}%` : "—"}</span>
                  {c.liveLaborPct != null ? <span className="ml-1 text-[10px] text-muted-foreground">({Math.round(c.liveLaborPct)}% now)</span> : null}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">{c.splhToday != null ? `$${Math.round(c.splhToday)}` : "—"}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{c.fitScore != null ? c.fitScore : "—"}</td>
                <td className="px-2 py-2.5 pr-4 text-right tabular-nums">
                  <span className={c.trendWowPct == null ? "text-muted-foreground" : c.trendWowPct >= 0 ? "text-success" : "text-destructive"}>
                    {c.trendWowPct != null ? `${c.trendWowPct >= 0 ? "+" : ""}${Math.round(c.trendWowPct)}%` : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ label, k, sort, dir, onClick, align, plain, className }: { label: string; k?: SortKey; sort?: SortKey; dir?: 1 | -1; onClick?: (k: SortKey) => void; align?: boolean; plain?: boolean; className?: string }) {
  if (plain || !k) return <th className={cn("px-2 py-2 font-medium", align && "text-right", className)}>{label}</th>;
  const active = sort === k;
  return (
    <th className={cn("px-2 py-2 font-medium", align && "text-right", className)}>
      <button type="button" onClick={() => onClick?.(k)} className={cn("inline-flex items-center gap-1", align && "flex-row-reverse", active && "text-foreground")}>
        {label}
        <ArrowUpDown className={cn("h-3 w-3 transition", active ? "opacity-100" : "opacity-30", active && dir === 1 && "rotate-180")} />
      </button>
    </th>
  );
}

function Ghost({ actual, forecast }: { actual: number[]; forecast: number[] }) {
  const n = Math.max(actual.length, forecast.length);
  if (n < 2 || (actual.every((v) => !v) && forecast.every((v) => !v))) return <span className="text-[10px] text-muted-foreground">—</span>;
  const max = Math.max(1, ...actual, ...forecast);
  const W = 84;
  const H = 22;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - (v / max) * (H - 2) - 1;
  const aPts = actual.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fPts = forecast.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="inline-block align-middle" aria-hidden="true">
      <polyline points={fPts} fill="none" stroke={MUTE} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
      {aPts ? <polyline points={aPts} fill="none" stroke={INFO} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
    </svg>
  );
}

function LaborLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
      <span>Labor:</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-success" /> ≤ target</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-warning" /> ≤ +5</span>
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-destructive" /> over</span>
    </div>
  );
}

function laborToneClass(pct: number | null, target: number): string {
  if (pct == null) return "text-muted-foreground";
  if (pct <= target) return "text-success";
  if (pct <= target + 5) return "text-warning-foreground";
  return "text-destructive";
}
