// Pure per-store metric functions — no I/O, no server-only imports, unit-tested.
// Phase C's store cards render straight from these; keeping them pure means the
// numbers are verifiable and the UI stays dumb.
//
// Conventions: hourly arrays are length 24, indexed by store-local hour; "sales"
// is net (Σ check.amount, matching the forecast). nowHour is fractional
// (e.g. 14.5 = 2:30pm). Forecast is prorated to the current hour; actual is
// already real cumulative, so it is summed as-is.

export function sum(hours: number[]): number {
  let s = 0;
  for (const v of hours) s += v ?? 0;
  return s;
}

/** Forecast accrued by `nowHour`: full past hours + a slice of the current one. */
export function cumulativeToNow(hours: number[], nowHour: number): number {
  let s = 0;
  for (let h = 0; h < 24; h++) {
    if (h + 1 <= nowHour) s += hours[h] ?? 0;
    else if (h < nowHour) s += (hours[h] ?? 0) * (nowHour - h);
  }
  return s;
}

/** Sum of an hourly array over the window [from, to) (fractional, prorated). */
export function windowSum(hours: number[], from: number, to: number): number {
  let s = 0;
  for (let h = 0; h < 24; h++) {
    const lo = Math.max(h, from);
    const hi = Math.min(h + 1, to);
    if (hi > lo) s += (hours[h] ?? 0) * (hi - lo);
  }
  return s;
}

// ── Pace ────────────────────────────────────────────────────────────────────

export interface PaceResult {
  actualToNow: number;
  forecastToNow: number;
  pacePct: number | null; // actual ÷ forecast-to-now × 100
  deltaPct: number | null; // pacePct − 100 (the "+12% / −8%")
}

export function paceToNow(actualHour: number[], forecastHour: number[], nowHour: number): PaceResult {
  const actualToNow = sum(actualHour); // actual beyond now is 0; current hour is real
  const forecastToNow = cumulativeToNow(forecastHour, nowHour);
  const pacePct = forecastToNow > 0 ? (actualToNow / forecastToNow) * 100 : null;
  return { actualToNow: Math.round(actualToNow), forecastToNow: Math.round(forecastToNow), pacePct, deltaPct: pacePct != null ? pacePct - 100 : null };
}

/** Where today lands at the current pace (guards the volatile early morning). */
export function projectedFinish(actualToNow: number, forecastToNow: number, forecastDay: number): number | null {
  if (forecastDay <= 0) return null;
  if (forecastToNow < forecastDay * 0.05) return Math.round(forecastDay);
  return Math.round(forecastDay * (actualToNow / forecastToNow));
}

// ── Busy now ──────────────────────────────────────────────────────────────

export interface BusyResult {
  actualWindow: number;
  forecastWindow: number;
  indexPct: number | null; // >100 = busier than forecast for this time of day
}

/** Last `windowHours` of actual vs forecast for that same window. */
export function busyNow(actualHour: number[], forecastHour: number[], nowHour: number, windowHours = 1): BusyResult {
  const from = Math.max(0, nowHour - windowHours);
  const actualWindow = windowSum(actualHour, from, nowHour);
  const forecastWindow = windowSum(forecastHour, from, nowHour);
  return { actualWindow: Math.round(actualWindow), forecastWindow: Math.round(forecastWindow), indexPct: forecastWindow > 0 ? (actualWindow / forecastWindow) * 100 : null };
}

// ── Labor ─────────────────────────────────────────────────────────────────

/** Projected end-of-day labor % — the number we color. Live % is secondary. */
export function projectedEodLaborPct(x: { laborSoFar: number; scheduledLaborRemaining: number; salesSoFar: number; forecastRemaining: number }): number | null {
  const labor = x.laborSoFar + x.scheduledLaborRemaining;
  const sales = x.salesSoFar + x.forecastRemaining;
  return sales > 0 ? (labor / sales) * 100 : null;
}

export interface LaborBudget {
  budget: number; // forecast sales × target %
  projectedLabor: number;
  deltaDollars: number; // projected − budget (+ = over)
  pct: number | null;
}

export function laborVsBudget(projectedLabor: number, forecastSales: number, targetPct: number): LaborBudget {
  const budget = forecastSales * (targetPct / 100);
  return { budget: Math.round(budget), projectedLabor: Math.round(projectedLabor), deltaDollars: Math.round(projectedLabor - budget), pct: forecastSales > 0 ? (projectedLabor / forecastSales) * 100 : null };
}

/** Sales per labor hour. */
export function splh(sales: number, laborHours: number): number | null {
  return laborHours > 0 ? sales / laborHours : null;
}

// ── Streaks & trend ─────────────────────────────────────────────────────────

/** Count leading true values (most-recent-first), e.g. days in a row on target. */
export function consecutiveStreak(flagsMostRecentFirst: boolean[]): number {
  let n = 0;
  for (const f of flagsMostRecentFirst) {
    if (f) n++;
    else break;
  }
  return n;
}

export interface TrendResult {
  weeks: number[]; // most-recent-first net sales
  wowPct: number | null; // latest week vs the one before
  steps: Array<number | null>; // week-over-week % for each adjacent pair
}

/** 4-week net-sales trend from stored recentWeeks (most-recent-first). */
export function fourWeekTrend(weeksMostRecentFirst: number[]): TrendResult {
  const weeks = weeksMostRecentFirst.slice();
  const steps: Array<number | null> = [];
  for (let i = 0; i < weeks.length - 1; i++) {
    const prev = weeks[i + 1];
    steps.push(prev > 0 ? ((weeks[i] - prev) / prev) * 100 : null);
  }
  return { weeks, wowPct: steps.length ? steps[0] : null, steps };
}
