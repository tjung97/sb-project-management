"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";
import { updateLaborModel } from "@/src/lib/ops/actions";
import { cn } from "@/src/lib/utils";
import type { LaborModel } from "@/src/lib/ops/labor-model";

export interface LaborModelStoreRow {
  guid: string;
  name: string;
  impliedLaborPct: number | null; // from today's forecast + effective model
  openMin: number;
  closeMin: number;
  avgWage: number;
  minCrew: number;
  targetPct: number;
  overridden: boolean;
}

const minToTime = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}

// Admin editor for the staffing labor model: the sales→staff matrix, min crew,
// grade thresholds, and per-store hour/wage/crew overrides. The implied labor %
// column lets you tune the bands toward the target.
export function LaborModelSettings({ model, stores }: { model: LaborModel; stores: LaborModelStoreRow[] }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const bands = model.default.matrix.length ? model.default.matrix : [{ max: 149, staff: 2 }, { max: 299, staff: 3 }, { max: 449, staff: 4 }, { max: null, staff: 5 }];

  function onSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await updateLaborModel(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <SlidersHorizontal className="h-4 w-4 text-info" />
        <span className="text-sm font-semibold">Staffing labor model</span>
        <span className="ml-auto text-[11px] text-muted-foreground">min crew {model.default.minCrew} · fit ≥{model.grades.good} good</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <form action={onSubmit} className="space-y-5 border-t border-border/70 px-4 py-4">
          {/* Matrix */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Sales-per-hour → staff on floor</p>
            <div className="space-y-1.5">
              {bands.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">up to</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                    <input name={`band_max_${i}`} type="number" min={1} defaultValue={b.max ?? ""} placeholder={b.max == null ? "and up" : ""} className="h-8 w-24 rounded-lg border border-border/80 bg-background pl-5 pr-2 text-sm outline-none focus:border-info/60" />
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <input name={`band_staff_${i}`} type="number" min={0} defaultValue={b.staff} className="h-8 w-16 rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60" />
                  <span className="text-muted-foreground">staff</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Min crew (open hrs)</span>
              <input name="default_min_crew" type="number" min={0} max={20} defaultValue={model.default.minCrew} className="h-8 w-16 rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Fit: good ≥</span>
              <input name="grade_good" type="number" min={0} max={100} defaultValue={model.grades.good} className="h-8 w-16 rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">ok ≥</span>
              <input name="grade_ok" type="number" min={0} max={100} defaultValue={model.grades.ok} className="h-8 w-16 rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60" />
            </label>
          </div>

          {/* Per-store overrides */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Per-store hours, wage &amp; crew</p>
            <p className="text-[11px] text-muted-foreground">Hours default to each store&apos;s forecast curve; wage to recent Toast labor. Implied % = matrix staffing at target wage ÷ forecast sales.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-muted-foreground">
                    <th className="py-1 pr-2 font-medium">Store</th>
                    <th className="px-2 py-1 font-medium">Implied labor %</th>
                    <th className="px-2 py-1 font-medium">Open</th>
                    <th className="px-2 py-1 font-medium">Close</th>
                    <th className="px-2 py-1 font-medium">Avg wage</th>
                    <th className="px-2 py-1 font-medium">Min crew</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => {
                    const tone = s.impliedLaborPct == null ? "text-muted-foreground" : s.impliedLaborPct <= s.targetPct ? "text-success" : s.impliedLaborPct <= s.targetPct + 3 ? "text-warning-foreground" : "text-destructive";
                    return (
                      <tr key={s.guid} className="border-t border-border/40">
                        <td className="py-1.5 pr-2 font-medium">
                          {shortName(s.name)}
                          <input type="hidden" name="store_guid" value={s.guid} />
                        </td>
                        <td className={cn("px-2 py-1.5 tabular-nums", tone)}>{s.impliedLaborPct != null ? `${Math.round(s.impliedLaborPct)}% / ${s.targetPct}%` : "—"}</td>
                        <td className="px-2 py-1.5"><input name={`s_${s.guid}_open`} type="time" defaultValue={minToTime(s.openMin)} className="h-7 rounded-lg border border-border/80 bg-background px-1.5 text-xs outline-none focus:border-info/60" /></td>
                        <td className="px-2 py-1.5"><input name={`s_${s.guid}_close`} type="time" defaultValue={minToTime(s.closeMin)} className="h-7 rounded-lg border border-border/80 bg-background px-1.5 text-xs outline-none focus:border-info/60" /></td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                            <input name={`s_${s.guid}_avg_wage`} type="number" min={1} step={0.5} defaultValue={s.avgWage} className="h-7 w-16 rounded-lg border border-border/80 bg-background pl-4 pr-1 text-xs outline-none focus:border-info/60" />
                          </div>
                        </td>
                        <td className="px-2 py-1.5"><input name={`s_${s.guid}_min_crew`} type="number" min={0} max={20} defaultValue={s.minCrew} className="h-7 w-14 rounded-lg border border-border/80 bg-background px-1.5 text-xs outline-none focus:border-info/60" /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:opacity-50">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save model
            </button>
            {saved ? <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
