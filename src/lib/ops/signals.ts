// Rule-based store signals — ALL thresholds live here, in one place, so tuning
// is a single-file change. Pure + unit-tested; the dashboard cards and the
// Needs-attention / Wins strips both render from this.

export interface SignalThresholds {
  busyPct: number; // last-hour index ≥ 100 + this → "getting busy"
  aheadPct: number; // pace delta ≥ this → running ahead (a good signal)
  slowPaceDelta: number; // pace delta ≤ this (after minOpenHours) → "slow"
  minOpenHours: number; // hours open before "slow" is judged
  laborOverPts: number; // projected EOD labor % ≥ target + this → over
  understaffGap: number; // required − scheduled ≥ this within next 2h → understaffed
  winLaborUnderPts: number; // ≥ this many points under target → a labor "win"
  winPaceBeat: number; // pace delta ≥ this → a pace "win"
}

export const DEFAULT_THRESHOLDS: SignalThresholds = {
  busyPct: 20,
  aheadPct: 10,
  slowPaceDelta: -15,
  minOpenHours: 2,
  laborOverPts: 5,
  understaffGap: 0.5,
  winLaborUnderPts: 3,
  winPaceBeat: 10,
};

export type Severity = "attention" | "good" | "neutral" | "nodata";
export type SignalKind = "data_missing" | "understaffed" | "labor_over" | "slow" | "busy" | "ahead" | "labor_on_target" | "on_plan";

export interface Signal {
  kind: SignalKind;
  severity: Severity;
  detail: string;
}

export type LaborOverReason = "extra hours" | "prep hours" | "slow sales";

export interface SignalInputs {
  hasToastData: boolean;
  hasSlingMatch: boolean;
  openHoursElapsed: number;
  paceDelta: number | null;
  busyIndexPct: number | null;
  projEodLaborPct: number | null;
  laborTargetPct: number;
  understaffNext2h: number; // max (required − scheduled) over open hours in [now, now+2h]
  laborOverReason: LaborOverReason;
}

export interface SignalResult {
  status: Severity;
  why: string; // the primary signal's detail
  signals: Signal[]; // all that fired, most-severe first
}

const signed = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)}%`;

// Priority order for the "primary" signal (what the card's why line shows).
const PRIORITY: SignalKind[] = ["data_missing", "understaffed", "labor_over", "slow", "busy", "ahead", "labor_on_target", "on_plan"];

export function evaluateSignals(i: SignalInputs, t: SignalThresholds = DEFAULT_THRESHOLDS): SignalResult {
  if (!i.hasToastData) {
    const s: Signal = { kind: "data_missing", severity: "nodata", detail: "No Toast data today" };
    return { status: "nodata", why: s.detail, signals: [s] };
  }

  const signals: Signal[] = [];

  if (i.hasSlingMatch && i.understaffNext2h >= t.understaffGap) {
    signals.push({ kind: "understaffed", severity: "attention", detail: `Understaffed — short ${Math.round(i.understaffNext2h)} in next 2h` });
  }

  if (i.projEodLaborPct != null && i.projEodLaborPct >= i.laborTargetPct + t.laborOverPts) {
    signals.push({ kind: "labor_over", severity: "attention", detail: `Labor ${Math.round(i.projEodLaborPct)}% proj vs ${i.laborTargetPct}% (${i.laborOverReason})` });
  }

  if (i.paceDelta != null && i.paceDelta <= t.slowPaceDelta && i.openHoursElapsed >= t.minOpenHours) {
    signals.push({ kind: "slow", severity: "attention", detail: `Slow — sales ${signed(i.paceDelta)} vs forecast` });
  }

  if (i.busyIndexPct != null && i.busyIndexPct >= 100 + t.busyPct) {
    signals.push({ kind: "busy", severity: "neutral", detail: `Getting busy — last hr ${signed(i.busyIndexPct - 100)} vs forecast` });
  }

  if (i.paceDelta != null && i.paceDelta >= t.aheadPct) {
    signals.push({ kind: "ahead", severity: "good", detail: `Running ${signed(i.paceDelta)} vs forecast` });
  }

  if (i.projEodLaborPct != null && i.projEodLaborPct <= i.laborTargetPct) {
    signals.push({ kind: "labor_on_target", severity: "good", detail: `Labor on target (${Math.round(i.projEodLaborPct)}% vs ${i.laborTargetPct}%)` });
  }

  if (!signals.length) signals.push({ kind: "on_plan", severity: "neutral", detail: "On plan" });

  signals.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));

  const status: Severity = signals.some((s) => s.severity === "attention")
    ? "attention"
    : signals.some((s) => s.severity === "good")
      ? "good"
      : "neutral";

  return { status, why: signals[0].detail, signals };
}

// ── Wins (so good stores get noticed) ─────────────────────────────────────────

export interface WinInput {
  guid: string;
  name: string;
  projEodLaborPct: number | null;
  laborTargetPct: number;
  paceDelta: number | null;
  hasToastData: boolean;
}

export interface Win {
  kind: "labor" | "pace";
  guid: string;
  name: string;
  detail: string;
}

export function buildWins(stores: WinInput[], t: SignalThresholds = DEFAULT_THRESHOLDS): Win[] {
  const wins: Win[] = [];
  const live = stores.filter((s) => s.hasToastData);

  const laborLeader = live
    .filter((s) => s.projEodLaborPct != null && s.laborTargetPct - s.projEodLaborPct >= t.winLaborUnderPts)
    .sort((a, b) => b.laborTargetPct - b.projEodLaborPct! - (a.laborTargetPct - a.projEodLaborPct!))[0];
  if (laborLeader) {
    const under = Math.round(laborLeader.laborTargetPct - laborLeader.projEodLaborPct!);
    wins.push({ kind: "labor", guid: laborLeader.guid, name: laborLeader.name, detail: `best labor control — ${Math.round(laborLeader.projEodLaborPct!)}% (${under} under target)` });
  }

  const paceLeader = live
    .filter((s) => s.paceDelta != null && s.paceDelta >= t.winPaceBeat)
    .sort((a, b) => (b.paceDelta ?? 0) - (a.paceDelta ?? 0))[0];
  if (paceLeader && paceLeader.guid !== laborLeader?.guid) {
    wins.push({ kind: "pace", guid: paceLeader.guid, name: paceLeader.name, detail: `biggest pace beat — ${signed(paceLeader.paceDelta!)} vs forecast` });
  }

  return wins;
}
