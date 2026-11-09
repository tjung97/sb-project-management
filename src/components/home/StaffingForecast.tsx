import { Users, TriangleAlert, Check, Info } from "lucide-react";
import { cn } from "@/src/lib/utils";
import type { StaffingForecast as StaffingData, StoreStaffing, HourStatus } from "@/src/lib/ops/staffing";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? "a" : "p";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${ampm}`;
}

function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}

// Phase 2 — staffing vs projected demand, per store, today. Each store shows an
// hour strip: bar height = projected sales that hour, number on top = scheduled
// headcount, tint = under/over/ok relative to how demand is distributed.
export function StaffingForecast({ data }: { data: StaffingData }) {
  if (!data.configured) return null;

  return (
    <section className="dash-rise overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-2.5">
        <Users className="h-4 w-4 text-info" />
        <h2 className="text-sm font-semibold">Staffing vs forecast · today</h2>
        <span className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Dot status="under" /> Understaffed</span>
          <span className="inline-flex items-center gap-1"><Dot status="over" /> Overstaffed</span>
          <span className="inline-flex items-center gap-1"><Dot status="ok" /> Aligned</span>
        </span>
      </div>

      <div className="divide-y divide-border/50">
        {data.stores.map((s) => (
          <StoreStrip key={s.guid} store={s} />
        ))}
      </div>

      <details className="border-t border-border/60 px-4 py-3 text-xs">
        <summary className="flex cursor-pointer items-center gap-2 font-medium text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> How alignment is judged
        </summary>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          We hold the labor you&apos;ve scheduled fixed and check whether it&apos;s spread to match when sales come in: for each
          hour, expected staff = your total staffed hours × that hour&apos;s share of projected sales. An hour with a real rush
          but noticeably fewer people than its share flags <span className="text-warning-foreground">understaffed</span>; the
          reverse flags <span className="text-info">overstaffed</span>. It needs no wage data — it&apos;s purely whether the
          schedule&apos;s shape follows the forecast&apos;s shape. Bars are projected sales per hour; the number on each bar is
          scheduled headcount.
        </p>
      </details>
    </section>
  );
}

function StoreStrip({ store }: { store: StoreStaffing }) {
  const maxDemand = Math.max(1, ...store.hours.map((h) => h.demand));
  const hasUnder = store.hours.some((h) => h.status === "under");
  const hasOver = store.hours.some((h) => h.status === "over");
  const tone = !store.matched || store.totalStaffHours === 0 ? "muted" : hasUnder ? "warning" : hasOver ? "info" : "success";

  return (
    <div className="px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-sm font-medium">{shortName(store.name)}</span>
        <VerdictChip tone={tone} text={store.verdict} />
        {store.totalStaffHours > 0 ? (
          <span className="ml-auto text-[10px] text-muted-foreground">
            {store.totalStaffHours} staff-hrs · peak {store.peakStaff}
          </span>
        ) : null}
      </div>

      {store.totalStaffHours === 0 && !store.hours.some((h) => h.demand > 0) ? (
        <p className="text-xs text-muted-foreground">No data for today.</p>
      ) : (
        <div className="flex items-end gap-[3px] overflow-x-auto pb-1">
          {store.hours.map((h) => {
            const barH = Math.round((h.demand / maxDemand) * 40) + 2;
            return (
              <div key={h.hour} className="flex min-w-[26px] flex-1 flex-col items-center gap-0.5" title={`${hourLabel(h.hour)} — forecast ${money.format(h.demand)} · ${h.staff} staff`}>
                <span className={cn("text-[10px] font-semibold tabular-nums", staffTextTone(h.status, store.totalStaffHours > 0))}>
                  {store.totalStaffHours > 0 ? (Number.isInteger(h.staff) ? h.staff : h.staff.toFixed(1)) : "·"}
                </span>
                <div className="flex w-full items-end justify-center" style={{ height: 44 }}>
                  <div className={cn("w-full rounded-sm", barTone(h.status, store.totalStaffHours > 0))} style={{ height: barH }} />
                </div>
                <span className="text-[9px] text-muted-foreground">{hourLabel(h.hour)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VerdictChip({ tone, text }: { tone: "warning" | "info" | "success" | "muted"; text: string }) {
  const cls =
    tone === "warning"
      ? "bg-warning/15 text-warning-foreground"
      : tone === "info"
        ? "bg-info/15 text-info"
        : tone === "success"
          ? "bg-success/15 text-success"
          : "bg-muted text-muted-foreground";
  const Icon = tone === "warning" ? TriangleAlert : tone === "success" ? Check : Info;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}

function Dot({ status }: { status: HourStatus }) {
  return <span className={cn("inline-block h-2 w-2 rounded-sm", barTone(status, true))} />;
}

function barTone(status: HourStatus, hasStaff: boolean): string {
  if (!hasStaff) return "bg-muted";
  if (status === "under") return "bg-warning/70";
  if (status === "over") return "bg-info/60";
  return "bg-success/55";
}

function staffTextTone(status: HourStatus, hasStaff: boolean): string {
  if (!hasStaff) return "text-muted-foreground";
  if (status === "under") return "text-warning-foreground";
  if (status === "over") return "text-info";
  return "text-foreground";
}
