import "server-only";

import { adminDb } from "@/src/lib/firebase/admin";
import { DEFAULT_MATRIX, DEFAULT_MIN_CREW, DEFAULT_GRADES, type LaborMatrix } from "@/src/lib/ops/staffing-math";

// Admin-editable staffing model, stored at ops_config/labor_model. A single
// default plus per-store overrides. Anything left null is auto-derived by the
// staffing orchestrator: openMin/closeMin from the store's forecast curve,
// avgWage from the store's recent Toast labor (laborCost ÷ laborHours).

export interface StoreLaborModel {
  matrix: LaborMatrix;
  minCrew: number;
  avgWage: number | null; // loaded hourly rate; null = auto-derive
  openMin: number | null; // minutes since midnight; null = auto-derive
  closeMin: number | null;
}

export interface LaborModel {
  default: StoreLaborModel;
  perStore: Record<string, Partial<StoreLaborModel>>;
  grades: { good: number; ok: number };
}

export const DEFAULT_LABOR_MODEL: LaborModel = {
  default: { matrix: DEFAULT_MATRIX, minCrew: DEFAULT_MIN_CREW, avgWage: null, openMin: null, closeMin: null },
  perStore: {},
  grades: { good: DEFAULT_GRADES.good, ok: DEFAULT_GRADES.ok },
};

const COLLECTION = "ops_config";
const DOC = "labor_model";

function parseMatrix(raw: unknown): LaborMatrix | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const bands: LaborMatrix = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const rec = b as Record<string, unknown>;
    const staff = Number(rec.staff);
    const max = rec.max === null || rec.max === undefined ? null : Number(rec.max);
    if (!Number.isFinite(staff) || staff < 0) continue;
    bands.push({ max: max != null && Number.isFinite(max) ? max : null, staff: Math.round(staff) });
  }
  if (!bands.length) return null;
  // Open-ended band must be last.
  bands.sort((a, b) => (a.max == null ? 1 : b.max == null ? -1 : a.max - b.max));
  return bands;
}

function parseStore(raw: unknown): Partial<StoreLaborModel> {
  const rec = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Partial<StoreLaborModel> = {};
  const matrix = parseMatrix(rec.matrix);
  if (matrix) out.matrix = matrix;
  if (typeof rec.min_crew === "number" && rec.min_crew >= 0) out.minCrew = Math.round(rec.min_crew);
  if (typeof rec.avg_wage === "number" && rec.avg_wage > 0) out.avgWage = rec.avg_wage;
  if (typeof rec.open_min === "number" && rec.open_min >= 0) out.openMin = Math.round(rec.open_min);
  if (typeof rec.close_min === "number" && rec.close_min > 0) out.closeMin = Math.round(rec.close_min);
  return out;
}

export async function getLaborModel(): Promise<LaborModel> {
  try {
    const snap = await adminDb.collection(COLLECTION).doc(DOC).get();
    if (!snap.exists) return DEFAULT_LABOR_MODEL;
    const d = snap.data() ?? {};
    const def = parseStore(d.default);
    const perStore: Record<string, Partial<StoreLaborModel>> = {};
    if (d.per_store && typeof d.per_store === "object") {
      for (const [guid, v] of Object.entries(d.per_store as Record<string, unknown>)) perStore[guid] = parseStore(v);
    }
    const grades = {
      good: typeof d.grade_good === "number" ? d.grade_good : DEFAULT_GRADES.good,
      ok: typeof d.grade_ok === "number" ? d.grade_ok : DEFAULT_GRADES.ok,
    };
    return {
      default: { ...DEFAULT_LABOR_MODEL.default, ...def },
      perStore,
      grades,
    };
  } catch {
    return DEFAULT_LABOR_MODEL;
  }
}

/** Resolve the effective model for one store (default merged with its overrides). */
export function modelForStore(model: LaborModel, guid: string): StoreLaborModel {
  return { ...model.default, ...(model.perStore[guid] ?? {}) };
}
