// Pure staffing math — no I/O, no server-only imports, fully unit-testable.
//
// Converts a forecast sales curve into "required staff per hour" via a labor
// matrix, compares it to scheduled coverage in the same unit (people), and
// scores how well the schedule's SHAPE follows demand. Schedules can't match
// hour-by-hour (no one works a 1-hour shift), so we judge trend + totals:
// over/under hours, how many are merely MISPLACED (movable, not cuttable), net
// hours vs need, a 0–100 fit score, and projected labor $ / %.

export interface LaborBand {
  /** Upper bound of forecast sales for this band; null = top (open-ended) band. */
  max: number | null;
  staff: number;
}
export type LaborMatrix = LaborBand[];

export const DEFAULT_MATRIX: LaborMatrix = [
  { max: 149, staff: 2 },
  { max: 299, staff: 3 },
  { max: 449, staff: 4 },
  { max: null, staff: 5 },
];
export const DEFAULT_MIN_CREW = 2;
export const DEFAULT_TOL = 0.5;
export const DEFAULT_GRADES = { good: 90, ok: 80 } as const;

export type HourStatus = "under" | "over" | "ok" | "prep";
export type FitGrade = "good" | "ok" | "poor";

export interface StaffHourResult {
  hour: number; // 0..23
  open: boolean; // customer-open hour
  forecast: number; // projected $ this hour
  actual: number | null; // actual $ if the hour has passed, else null
  required: number; // 0 when not open
  scheduled: number; // coverage (fractional person-hours/hour), breaks removed
  gap: number; // scheduled − required (meaningful only when open)
  status: HourStatus;
}

export interface StaffingResult {
  hours: StaffHourResult[];
  requiredHours: number; // Σ required over open hours
  scheduledHours: number; // Σ scheduled over open hours (fit/net basis)
  overHours: number;
  underHours: number;
  misplacedHours: number; // min(over, under) — movable, not cuttable
  netHours: number; // Σscheduled − Σrequired (open hours); + = too many
  fitScore: number; // 0..100
  grade: FitGrade;
  prepHours: number; // scheduled person-hours outside open hours (side work)
  projectedLaborCost: number; // ALL scheduled hours (incl. prep) × wage
  projectedLaborPct: number | null; // projectedLaborCost ÷ forecast day sales
  summary: string;
}

export interface StaffingInputs {
  forecastHour: number[]; // length 24, projected $ per hour
  scheduledHour: number[]; // length 24, coverage per hour (breaks already removed)
  actualHour?: Array<number | null>; // length 24, actual $ per past hour
  openMin: number; // store open, minutes since midnight
  closeMin: number; // store close, minutes since midnight
  minCrew?: number;
  matrix?: LaborMatrix;
  avgWage: number; // loaded hourly rate for projected labor $
  tol?: number;
  grades?: { good: number; ok: number };
}

/** Staff implied by the matrix for a given hour's forecast sales. */
export function matrixStaff(matrix: LaborMatrix, sales: number): number {
  for (const band of matrix) {
    if (band.max === null || sales <= band.max) return band.staff;
  }
  return matrix.length ? matrix[matrix.length - 1].staff : 0;
}

/** Required staff on the floor for an open hour (floored by minCrew). */
export function requiredStaff(matrix: LaborMatrix, minCrew: number, sales: number): number {
  return Math.max(minCrew, matrixStaff(matrix, sales));
}

/** Is hour h a customer-open hour? (block start within [openMin, closeMin)) */
export function isOpenHour(hour: number, openMin: number, closeMin: number): boolean {
  const blockStart = hour * 60;
  return blockStart >= openMin && blockStart < closeMin;
}

export interface ShiftInterval {
  startMin: number;
  endMin: number; // may exceed 1440 for overnight
  breaks?: Array<{ startMin: number; endMin: number }>; // unpaid breaks, only if on the shift
}

/** Coverage per hour from shifts: Σ paid minutes within the hour ÷ 60. */
export function coverageFromShifts(shifts: ShiftInterval[]): number[] {
  const arr = new Array(24).fill(0);
  for (const s of shifts) {
    for (let h = 0; h < 24; h++) {
      const hs = h * 60;
      const he = hs + 60;
      let paid = Math.max(0, Math.min(he, s.endMin) - Math.max(hs, s.startMin));
      for (const b of s.breaks ?? []) {
        paid -= Math.max(0, Math.min(he, b.endMin) - Math.max(hs, b.startMin));
      }
      arr[h] += Math.max(0, paid) / 60;
    }
  }
  return arr;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function computeStaffing(inputs: StaffingInputs): StaffingResult {
  const matrix = inputs.matrix ?? DEFAULT_MATRIX;
  const minCrew = inputs.minCrew ?? DEFAULT_MIN_CREW;
  const tol = inputs.tol ?? DEFAULT_TOL;
  const grades = inputs.grades ?? DEFAULT_GRADES;

  const hours: StaffHourResult[] = [];
  let requiredHours = 0;
  let scheduledOpen = 0;
  let overHours = 0;
  let underHours = 0;
  let prepHours = 0;

  for (let h = 0; h < 24; h++) {
    const open = isOpenHour(h, inputs.openMin, inputs.closeMin);
    const forecast = inputs.forecastHour[h] ?? 0;
    const scheduled = inputs.scheduledHour[h] ?? 0;
    const actual = inputs.actualHour?.[h] ?? null;
    const required = open ? requiredStaff(matrix, minCrew, forecast) : 0;
    const gap = scheduled - required;

    let status: HourStatus;
    if (!open) {
      status = "prep";
      if (scheduled > 0.01) prepHours += scheduled;
    } else {
      requiredHours += required;
      scheduledOpen += scheduled;
      if (gap > tol) {
        overHours += gap;
        status = "over";
      } else if (gap < -tol) {
        underHours += -gap;
        status = "under";
      } else {
        status = "ok";
      }
    }

    // Skip hours with no activity at all (keeps the chart to the real day).
    if (!open && scheduled <= 0.01 && forecast <= 0 && (actual == null || actual <= 0)) continue;

    hours.push({ hour: h, open, forecast: Math.round(forecast), actual: actual != null ? Math.round(actual) : null, required, scheduled: round1(scheduled), gap: round1(gap), status });
  }

  const misplacedHours = Math.min(overHours, underHours);
  const netHours = scheduledOpen - requiredHours;
  const denom = requiredHours + scheduledOpen;
  const fitScore = denom > 0 ? Math.round(100 * (1 - (overHours + underHours) / denom)) : 100;
  const grade: FitGrade = fitScore >= grades.good ? "good" : fitScore >= grades.ok ? "ok" : "poor";

  const forecastDaySales = inputs.forecastHour.reduce((a, b) => a + (b ?? 0), 0);
  const projectedLaborCost = (scheduledOpen + prepHours) * inputs.avgWage;
  const projectedLaborPct = forecastDaySales > 0 ? (projectedLaborCost / forecastDaySales) * 100 : null;

  const overRanges = groupHourRanges(hours.filter((r) => r.status === "over").map((r) => r.hour));
  const underRanges = groupHourRanges(hours.filter((r) => r.status === "under").map((r) => r.hour));
  const summary = buildSummary({ projectedLaborPct, misplacedHours, netHours, overRanges, underRanges, prepHours });

  return {
    hours,
    requiredHours: round1(requiredHours),
    scheduledHours: round1(scheduledOpen),
    overHours: round1(overHours),
    underHours: round1(underHours),
    misplacedHours: round1(misplacedHours),
    netHours: round1(netHours),
    fitScore,
    grade,
    prepHours: round1(prepHours),
    projectedLaborCost: Math.round(projectedLaborCost),
    projectedLaborPct: projectedLaborPct != null ? round1(projectedLaborPct) : null,
    summary,
  };
}

function buildSummary(x: {
  projectedLaborPct: number | null;
  misplacedHours: number;
  netHours: number;
  overRanges: string[];
  underRanges: string[];
  prepHours: number;
}): string {
  const parts: string[] = [];
  const misplaced = Math.round(x.misplacedHours);
  const net = Math.round(x.netHours);
  if (misplaced > 0) {
    const bits: string[] = [];
    if (x.overRanges.length) bits.push(`extra ${x.overRanges.join(", ")}`);
    if (x.underRanges.length) bits.push(`short ${x.underRanges.join(", ")}`);
    parts.push(`${misplaced} hr${misplaced === 1 ? "" : "s"} misplaced${bits.length ? `: ${bits.join(" and ")}` : ""}`);
  } else if (net === 0) {
    parts.push("schedule matches the forecast");
  }
  if (net > 0) parts.push(`${net} hr${net === 1 ? "" : "s"} over need`);
  else if (net < 0) parts.push(`${-net} hr${-net === 1 ? "" : "s"} under need`);
  return parts.join(" · ") || "aligned";
}

export function hourLabel(h: number): string {
  const hr = ((h % 24) + 24) % 24;
  const ampm = hr < 12 ? "a" : "p";
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return `${h12}${ampm}`;
}

/** Collapse a sorted hour list into labelled ranges, e.g. [12,13,17] → "12p–2p, 5p–6p". */
export function groupHourRanges(hoursAsc: number[]): string[] {
  if (!hoursAsc.length) return [];
  const sorted = [...hoursAsc].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const h = sorted[i];
    if (h === prev + 1) {
      prev = h;
      continue;
    }
    ranges.push(`${hourLabel(start)}–${hourLabel(prev + 1)}`);
    start = h;
    prev = h;
  }
  return ranges;
}
