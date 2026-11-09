"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, Percent } from "lucide-react";
import { updateLaborTargets } from "@/src/lib/ops/actions";
import { cn } from "@/src/lib/utils";
import type { LaborTargets } from "@/src/lib/ops/labor-target";

// Operations-tab editor for the labor-cost % target (labor ÷ sales). A single
// default plus optional per-store overrides. Admin-only. Drives the tone of the
// "Labor %" figures on the home dashboard. Blank override = inherit the default.
export function LaborTargetSettings({
  targets,
  stores,
}: {
  targets: LaborTargets;
  stores: Array<{ guid: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [defaultPct, setDefaultPct] = useState(targets.defaultPct);

  const overrideCount = Object.keys(targets.perStore).length;

  function onSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await updateLaborTargets(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Percent className="h-4 w-4 text-info" />
        <span className="text-sm font-semibold">Labor targets</span>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">{defaultPct}% default</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {overrideCount ? `${overrideCount} store override${overrideCount === 1 ? "" : "s"}` : "all stores use default"}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <form action={onSubmit} className="space-y-4 border-t border-border/70 px-4 py-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground" htmlFor="default_pct">
              Default target
            </label>
            <div className="relative">
              <input
                id="default_pct"
                name="default_pct"
                type="number"
                min={1}
                max={100}
                step={0.5}
                defaultValue={targets.defaultPct}
                onChange={(e) => setDefaultPct(Number(e.target.value) || 0)}
                className="h-8 w-24 rounded-lg border border-border/80 bg-background pl-2 pr-6 text-sm outline-none focus:border-info/60"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <span className="text-sm text-muted-foreground">labor cost ÷ sales</span>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Per-store overrides</p>
            <p className="text-[11px] text-muted-foreground">Leave blank to use the {defaultPct}% default.</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {stores.map((s) => (
                <label key={s.guid} className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{shortName(s.name)}</span>
                  <div className="relative">
                    <input
                      name={`store_pct_${s.guid}`}
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      defaultValue={targets.perStore[s.guid] ?? ""}
                      placeholder={String(targets.defaultPct)}
                      className="h-7 w-20 rounded-lg border border-border/80 bg-background pl-2 pr-5 text-xs outline-none focus:border-info/60"
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save targets
            </button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}
